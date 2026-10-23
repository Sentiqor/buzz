import * as React from "react";
import type { RelayAgent } from "@/shared/api/types";
import { useObserverEvents } from "./useObserverEvents";
import { AgentStatusPill } from "./AgentOverviewDemo";
import { buildLiveWorkers } from "./agentLiveStatus";

/** Live overview of one owned lead, derived only from its decrypted telemetry. */
export function LiveAgentOverview({ agent }: { agent: RelayAgent }) {
  const observer = useObserverEvents(true, agent.pubkey);
  const [now, setNow] = React.useState(Date.now);
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const workers = React.useMemo(
    () =>
      buildLiveWorkers(
        observer.events,
        now,
        observer.connectionState === "open",
      ),
    [observer.events, now, observer.connectionState],
  );
  const needsInput = workers.filter((w) =>
    ["Needs approval", "Blocked", "Failed"].includes(w.status),
  );
  const busy = workers.filter((w) =>
    ["Working", "Testing", "Reviewing"].includes(w.status),
  );
  const status =
    needsInput[0]?.status ??
    (busy.length
      ? "Working"
      : (workers.find((w) => w.status === "Waiting for CI")?.status ??
        (workers.length && workers.every((w) => w.status === "Completed")
          ? "Completed"
          : "Status unknown")));
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{agent.name || "Agent"}</h3>
          <AgentStatusPill status={status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {workers.length
            ? `${busy.length} workers active · ${needsInput.length} need attention`
            : "Waiting for worker telemetry"}
        </p>
        <p className="text-xs text-muted-foreground">
          Presence: {agent.status} · Stream: {observer.connectionState}
        </p>
        <p className="text-xs text-muted-foreground">
          Only observed workers are shown. Task stages are agent reports; a turn
          ending does not mean delivery is complete.
        </p>
        {observer.errorMessage && (
          <p role="alert" className="text-sm text-destructive">
            Activity unavailable. Reconnect to refresh.
          </p>
        )}
      </div>
      <ul className="divide-y border-t">
        {workers.map((worker) => (
          <li key={worker.index} className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                Worker {worker.index + 1}
              </h4>
              <AgentStatusPill status={worker.status} />
            </div>
            <p className="text-base font-medium break-words">{worker.task}</p>
            {worker.next && (
              <p className="text-sm break-words">
                <span className="font-medium">Next: </span>
                {worker.next}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {worker.source} · Updated{" "}
              {Math.max(0, Math.floor((now - worker.updatedAt) / 1000))}s ago
            </p>
            {worker.subagents.length ? (
              <details className="text-sm">
                <summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2">
                  {worker.subagents.length} observed subagents
                </summary>
                <ul className="mt-3 ml-2 space-y-3 border-l-2 pl-3">
                  {worker.subagents.map((sub) => (
                    <li key={sub.id} className="space-y-2">
                      <p className="break-words">{sub.task}</p>
                      <AgentStatusPill status={sub.status} />
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <p className="text-xs text-muted-foreground">
                No subagent activity observed for this turn.
              </p>
            )}
          </li>
        ))}
      </ul>
      {!workers.length && (
        <p className="px-5 pb-5 text-sm text-muted-foreground">
          No activity received in this client session.
        </p>
      )}
    </article>
  );
}
