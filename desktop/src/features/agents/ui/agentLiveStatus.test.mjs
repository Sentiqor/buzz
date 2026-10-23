import assert from "node:assert/strict";
import test from "node:test";
import { buildLiveWorkers } from "./agentLiveStatus.ts";

const now = Date.parse("2026-01-01T00:00:30Z");
const event = (seq, kind, payload = {}, extra = {}) => ({
  seq,
  timestamp: new Date(now - 10000 + seq).toISOString(),
  kind,
  agentIndex: 0,
  channelId: null,
  sessionId: "session",
  turnId: "turn-a",
  payload,
  ...extra,
});
const update = (seq, value, extra = {}) =>
  event(
    seq,
    "acp_read",
    { method: "session/update", params: { update: value } },
    extra,
  );
const report = (seq, stage, extra = {}) =>
  event(
    seq,
    "task_status",
    { version: 1, stage, task: "Improve navigation", next: "Check the tests" },
    extra,
  );
const project = (events) => buildLiveWorkers(events, now, true);

test("keeps concurrent DM/heartbeat workers separate and uses plan objectives", () => {
  const result = project([
    event(1, "turn_started"),
    event(
      2,
      "turn_started",
      { source: "heartbeat" },
      { agentIndex: 1, turnId: "turn-b" },
    ),
    update(3, {
      sessionUpdate: "plan",
      entries: [
        { content: "Improve record navigation", status: "in_progress" },
      ],
    }),
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].task, "Improve record navigation");
  assert.equal(result[1].task, "Scheduled check-in");
});
test("turn completion is not task completion and cannot be revived by late liveness", () => {
  const result = project([
    event(1, "turn_started"),
    event(2, "turn_completed"),
    event(3, "turn_liveness"),
  ]);
  assert.equal(result[0].status, "Turn ended");
});
test("failure survives the unconditional completion guard", () => {
  assert.equal(
    project([
      event(1, "turn_started"),
      event(2, "turn_error"),
      event(3, "turn_completed"),
    ])[0].status,
    "Failed",
  );
});
test("task report for an old turn cannot overwrite a new worker assignment", () => {
  const result = project([
    event(1, "turn_started"),
    event(2, "turn_started", {}, { turnId: "new" }),
    report(3, "completed"),
  ]);
  assert.equal(result[0].turnId, "new");
  assert.equal(result[0].status, "Working");
});
test("CI state requires a structured report and expires independently of liveness", () => {
  const events = [event(1, "turn_started"), report(2, "waiting_ci")];
  assert.equal(project(events)[0].status, "Waiting for CI");
  events.push(
    event(
      3,
      "turn_liveness",
      {},
      { timestamp: new Date(now + 150000).toISOString() },
    ),
  );
  assert.equal(
    buildLiveWorkers(events, now + 150001, true)[0].status,
    "Status unknown",
  );
});
test("explicit delegate calls are nested beneath the correct worker, not ordinary tools", () => {
  const events = [
    event(1, "turn_started"),
    update(2, {
      sessionUpdate: "tool_call",
      toolCallId: "child",
      name: "Agent",
      rawInput: { description: "Review the patch" },
      status: "in_progress",
    }),
    update(3, {
      sessionUpdate: "tool_call",
      toolCallId: "shell",
      name: "Bash",
      title: "Agent check",
      status: "in_progress",
    }),
    update(4, {
      sessionUpdate: "tool_call_update",
      toolCallId: "child",
      status: "completed",
    }),
  ];
  assert.deepEqual(
    project(events)[0].subagents.map((s) => [s.task, s.status]),
    [["Review the patch", "Completed"]],
  );
});
test("background launch completion does not claim subagent completion", () => {
  const result = project([
    event(1, "turn_started"),
    update(2, {
      sessionUpdate: "tool_call",
      toolCallId: "child",
      name: "Agent",
      rawInput: { run_in_background: true },
    }),
    update(3, {
      sessionUpdate: "tool_call_update",
      toolCallId: "child",
      status: "completed",
    }),
  ]);
  assert.equal(result[0].subagents[0].status, "Status unknown");
});
test("disconnects, stale and future telemetry are never working evidence", () => {
  const events = [event(1, "turn_started")];
  assert.equal(
    buildLiveWorkers(events, now, false)[0].status,
    "Status unknown",
  );
  assert.equal(
    buildLiveWorkers(events, now + 60001, true)[0].status,
    "Status unknown",
  );
  assert.deepEqual(
    project([
      event(
        1,
        "turn_started",
        {},
        { timestamp: new Date(now + 60000).toISOString() },
      ),
    ]),
    [],
  );
});
test("permission request and matching response update only their own worker", () => {
  const events = [
    event(1, "turn_started"),
    event(2, "acp_read", { id: 7, method: "session/request_permission" }),
  ];
  assert.equal(project(events)[0].status, "Needs approval");
  events.push(
    event(3, "acp_write", {
      id: 7,
      result: { outcome: { outcome: "selected" } },
    }),
  );
  assert.equal(project(events)[0].status, "Working");
});
test("invalid worker slots and unbound reports are ignored", () => {
  assert.deepEqual(
    project([
      event(1, "turn_started", {}, { agentIndex: 32 }),
      report(2, "completed"),
    ]),
    [],
  );
});

test("background subagent completion follows its correlated async lifecycle", () => {
  const events = [
    event(1, "turn_started"),
    update(2, {
      sessionUpdate: "tool_call",
      toolCallId: "child",
      name: "Agent",
      rawInput: { run_in_background: true, description: "Check API contract" },
    }),
    update(3, {
      sessionUpdate: "async_task_spawned",
      asyncTaskId: "async-child",
      toolCallId: "child",
    }),
    update(4, {
      sessionUpdate: "tool_call_update",
      toolCallId: "child",
      status: "completed",
    }),
    update(5, {
      sessionUpdate: "async_task_state_update",
      asyncTaskId: "async-child",
      state: "completed",
    }),
  ];
  assert.equal(project(events)[0].subagents[0].status, "Completed");
});

test("old worker liveness cannot replace a newer turn", () => {
  const events = [
    event(
      1,
      "turn_started",
      {},
      { startedAt: new Date(now - 1000).toISOString() },
    ),
    event(
      2,
      "turn_liveness",
      {},
      { turnId: "old", startedAt: new Date(now - 5000).toISOString() },
    ),
  ];
  assert.equal(project(events)[0].turnId, "turn-a");
});

test("invalid task reports do not refresh a stale worker", () => {
  const events = [
    event(1, "turn_started"),
    event(
      2,
      "task_status",
      { version: 1, stage: "invented", task: "bad" },
      { timestamp: new Date(now + 70000).toISOString() },
    ),
  ];
  assert.equal(
    buildLiveWorkers(events, now + 70000, true)[0].status,
    "Status unknown",
  );
});

test("finished turns clear active reported stages but preserve explicit outcomes", () => {
  for (const stage of ["working", "testing", "reviewing"]) {
    assert.equal(
      project([
        event(1, "turn_started"),
        report(2, stage),
        event(3, "turn_completed"),
      ])[0].status,
      "Turn ended",
    );
  }
  assert.equal(
    project([
      event(1, "turn_started"),
      report(2, "completed"),
      event(3, "turn_completed"),
    ])[0].status,
    "Completed",
  );
  assert.equal(
    project([event(1, "turn_started"), report(2, "toString")])[0].status,
    "Working",
  );
});
