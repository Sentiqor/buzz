import type { ObserverEvent } from "./agentSessionTypes";

export type LiveSubagent = {
  id: string;
  task: string;
  status: string;
  background?: boolean;
  asyncId?: string;
};
export type LiveWorker = {
  index: number;
  turnId: string | null;
  task: string;
  next: string;
  status: string;
  updatedAt: number;
  source: string;
  subagents: LiveSubagent[];
};
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown, max = 300): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const stages: Record<string, string> = {
  working: "Working",
  testing: "Testing",
  reviewing: "Reviewing",
  waiting_ci: "Waiting for CI",
  waiting_approval: "Needs approval",
  blocked: "Blocked",
  completed: "Completed",
  available: "Available",
};

/** Project bounded owner-decrypted observer events into worker slots.
 * Turn completion is never interpreted as task completion. */
export function buildLiveWorkers(
  events: readonly ObserverEvent[],
  now: number,
  connected: boolean,
): LiveWorker[] {
  const workers = new Map<number, LiveWorker>();
  const terminals = new Set<string>();
  const permissions = new Map<string, number>();
  const taskTimes = new Map<number, number>();
  const turnStarts = new Map<number, number>();
  const ordered = events
    .slice(-4000)
    .filter((e) => Number.isFinite(Date.parse(e.timestamp)))
    .sort(
      (a, b) =>
        Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.seq - b.seq,
    );
  for (const event of ordered) {
    const index = event.agentIndex;
    if (index === null || !Number.isInteger(index) || index < 0 || index >= 32)
      continue;
    const at = Date.parse(event.timestamp);
    if (at > now + 5000) continue;
    const payload = record(event.payload);
    const params = record(payload.params);
    const update = record(params.update);
    const relevant =
      [
        "turn_started",
        "turn_liveness",
        "turn_completed",
        "turn_error",
        "agent_panic",
        "agent_initialized",
        "task_status",
      ].includes(event.kind) ||
      (event.kind === "acp_read" &&
        (payload.method === "session/update" ||
          payload.method === "session/request_permission")) ||
      (event.kind === "acp_write" &&
        permissions.has(`${index}:${String(payload.id)}`));
    if (!relevant) continue;
    let worker = workers.get(index);
    if (
      event.kind === "task_status" &&
      (!worker ||
        !event.turnId ||
        event.turnId !== worker.turnId ||
        payload.version !== 1 ||
        !Object.hasOwn(stages, text(payload.stage)) ||
        !text(payload.task))
    )
      continue;
    if (!worker) {
      worker = {
        index,
        turnId: null,
        task: "Task not reported",
        next: "",
        status: "Status unknown",
        updatedAt: at,
        source: "Harness lifecycle",
        subagents: [],
      };
      workers.set(index, worker);
    }
    const turnKey = `${index}:${event.turnId}`;
    const terminal = ["turn_completed", "turn_error", "agent_panic"].includes(
      event.kind,
    );
    if (event.kind === "agent_initialized") {
      worker.turnId = null;
      worker.subagents = [];
      worker.task = "Task not reported";
      worker.status = "No active turn observed";
      worker.source = "Harness lifecycle";
      taskTimes.delete(index);
      turnStarts.delete(index);
    }
    if (event.turnId && worker.turnId !== event.turnId) {
      if (terminal || terminals.has(turnKey)) continue;
      if (
        worker.turnId &&
        !["turn_started", "turn_liveness"].includes(event.kind)
      )
        continue;
      const started = event.startedAt ? Date.parse(event.startedAt) : at;
      if (
        !Number.isFinite(started) ||
        started < (turnStarts.get(index) ?? -Infinity)
      )
        continue;
      turnStarts.set(index, started);
      worker.turnId = event.turnId;
      worker.subagents = [];
      worker.task =
        payload.source === "heartbeat"
          ? "Scheduled check-in"
          : "Task not reported";
      worker.next = "";
      worker.status = "Working";
      worker.source = "Harness lifecycle";
      taskTimes.delete(index);
    }
    if (
      terminals.has(turnKey) &&
      !terminal &&
      event.kind !== "task_status" &&
      !text(update.sessionUpdate).startsWith("async_task_")
    )
      continue;
    worker.updatedAt = at;
    if (terminal) {
      terminals.add(turnKey);
      if (event.kind !== "turn_completed") worker.status = "Failed";
      else if (
        worker.status !== "Failed" &&
        (!taskTimes.has(index) ||
          ["Working", "Testing", "Reviewing"].includes(worker.status))
      )
        worker.status = "Turn ended";
      for (const sub of worker.subagents) {
        if (!["Completed", "Failed", "Stopped"].includes(sub.status))
          sub.status = "Status unknown";
      }
    } else if (
      event.kind === "turn_started" ||
      event.kind === "turn_liveness"
    ) {
      if (!taskTimes.has(index) && worker.status !== "Needs approval")
        worker.status = "Working";
    } else if (event.kind === "task_status") {
      // Reports must be bound to the active turn, so a late report cannot alter
      // a worker that has since moved to another task.
      if (
        !event.turnId ||
        event.turnId !== worker.turnId ||
        payload.version !== 1
      )
        continue;
      const stage = stages[text(payload.stage)];
      const task = text(payload.task);
      if (!stage || !task) continue;
      worker.task = task;
      worker.next = text(payload.next);
      worker.status = stage;
      worker.source = "Agent-reported task status";
      taskTimes.set(index, at);
    } else if (payload.method === "session/request_permission") {
      worker.status = "Needs approval";
      permissions.set(`${index}:${String(payload.id)}`, index);
    } else if (
      event.kind === "acp_write" &&
      permissions.delete(`${index}:${String(payload.id)}`)
    ) {
      worker.status = "Working";
    } else if (update.sessionUpdate === "plan" && !taskTimes.has(index)) {
      const entries = Array.isArray(update.entries)
        ? update.entries.map(record)
        : [];
      const current =
        entries.find((e) => e.status === "in_progress") ??
        entries.find((e) => e.status === "pending");
      if (current && text(current.content)) {
        worker.task = text(current.content);
        worker.source = "Agent plan";
      }
    } else if (text(update.sessionUpdate).startsWith("async_task_")) {
      // Adapter async-task events are authoritative for background completion.
      // Correlate only with an observed delegate call; background shell jobs
      // are not subagents and cannot create child rows here.
      const asyncId = text(update.asyncTaskId, 160);
      const toolId = text(update.toolCallId, 160);
      const sub = worker.subagents.find(
        (s) =>
          (toolId && s.id === toolId) || (asyncId && s.asyncId === asyncId),
      );
      if (sub) {
        if (asyncId) sub.asyncId = asyncId;
        if (text(update.description)) sub.task = text(update.description);
        if (
          update.sessionUpdate === "async_task_spawned" ||
          update.state === "running"
        )
          sub.status = "Working";
        else if (update.state === "completed") sub.status = "Completed";
        else if (update.state === "failed") sub.status = "Failed";
        else if (update.state === "stopped") sub.status = "Stopped";
        else if (update.state === "paused") sub.status = "Paused";
      }
    } else if (
      update.sessionUpdate === "tool_call" ||
      update.sessionUpdate === "tool_call_update"
    ) {
      const id = text(update.toolCallId, 160);
      const meta = record(record(update._meta).claudeCode);
      const name = text(update.name || update.toolName || meta.toolName);
      let sub = worker.subagents.find((s) => s.id === id);
      // Only explicit delegate tool names count. Ordinary tools and shell
      // commands mentioning agents must not fabricate a child relationship.
      if (
        !sub &&
        id &&
        ["Agent", "Task", "spawn_agent"].includes(name) &&
        worker.subagents.length < 64
      ) {
        sub = {
          id,
          task: "Delegated task",
          status: "Working",
          background: name === "spawn_agent",
        };
        worker.subagents.push(sub);
      }
      if (sub) {
        const input = record(update.rawInput);
        if (input.run_in_background === true) sub.background = true;
        sub.task = text(input.description) || text(update.title) || sub.task;
        if (update.status === "completed")
          sub.status = sub.background ? "Status unknown" : "Completed";
        else if (update.status === "failed") sub.status = "Failed";
        else if (update.status === "pending" || update.status === "in_progress")
          sub.status = "Working";
      }
    }
  }
  return [...workers.values()]
    .sort((a, b) => a.index - b.index)
    .map((worker) => {
      const stale = !connected || now - worker.updatedAt > 60000;
      // A task report's lease is independent of turn liveness; background pings
      // cannot indefinitely renew an old CI or approval claim.
      const reportAt = taskTimes.get(worker.index);
      if (stale || (reportAt !== undefined && now - reportAt > 120000)) {
        worker.status = "Status unknown";
        worker.subagents = worker.subagents.map((sub) => ({
          ...sub,
          status: ["Completed", "Failed", "Stopped"].includes(sub.status)
            ? sub.status
            : "Status unknown",
        }));
      }
      return worker;
    });
}
