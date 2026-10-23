import { expect, test } from "@playwright/test";
import { installMockBridge } from "../helpers/bridge";
import { waitForAnimations } from "../helpers/animations";

test("status shows owned DM-only agents without claiming missing telemetry is idle", async ({
  page,
}) => {
  await installMockBridge(page, {
    managedAgents: [],
    relayAgents: [
      {
        pubkey: "a7".repeat(32),
        name: "Gateway Lead",
        ownerPubkey: "deadbeef".repeat(8),
        status: "online",
        channelNames: [],
        channelIds: [],
      },
      {
        pubkey: "a8".repeat(32),
        name: "Other owner's agent",
        ownerPubkey: "11".repeat(32),
        status: "online",
        channelNames: [],
        channelIds: [],
      },
    ],
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Agents", exact: true })
    .first()
    .click();
  await page.getByRole("tab", { name: "Status", exact: true }).click();
  const panel = page.getByRole("region", { name: "Agent status" });
  await expect(
    panel.getByRole("heading", { name: "Gateway Lead" }),
  ).toBeVisible();
  await expect(
    panel.getByText("Status unknown", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText("Other owner's agent")).toHaveCount(0);
  await expect(
    panel.getByText("No activity received in this client session."),
  ).toBeVisible();
  await page.evaluate(() => {
    const base = {
      agentIndex: 0,
      channelId: null,
      sessionId: "session-a",
      turnId: "turn-a",
    };
    const frame = (
      seq: number,
      kind: string,
      payload: unknown,
      extra = {},
    ) => ({
      ...base,
      seq,
      kind,
      payload,
      timestamp: new Date(Date.now() - 1000 + seq).toISOString(),
      ...extra,
    });
    window.__BUZZ_E2E_SEED_OBSERVER_EVENTS__?.({
      agentPubkey: "a7".repeat(32),
      events: [
        frame(1, "turn_started", {}),
        frame(2, "acp_read", {
          method: "session/update",
          params: {
            update: {
              sessionUpdate: "plan",
              entries: [
                { content: "Improve record navigation", status: "in_progress" },
              ],
            },
          },
        }),
        frame(3, "acp_read", {
          method: "session/update",
          params: {
            update: {
              sessionUpdate: "tool_call",
              toolCallId: "review",
              name: "Agent",
              status: "in_progress",
              rawInput: { description: "Review navigation changes" },
            },
          },
        }),
        frame(4, "turn_started", {}, { agentIndex: 1, turnId: "turn-b" }),
        frame(
          5,
          "task_status",
          {
            version: 1,
            stage: "waiting_ci",
            task: "Validate search improvements",
            next: "Recheck the CI run",
          },
          { agentIndex: 1, turnId: "turn-b" },
        ),
      ],
    });
  });
  await expect(
    panel.getByRole("heading", { name: "Worker 1", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("heading", { name: "Worker 2", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Improve record navigation", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Validate search improvements", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Waiting for CI", { exact: true }),
  ).toBeVisible();
  await panel.getByText("1 observed subagents", { exact: true }).click();
  await expect(
    panel.getByText("Review navigation changes", { exact: true }),
  ).toBeVisible();
  await waitForAnimations(page);
  await panel.screenshot({ path: "test-results/agent-status/status.png" });
  await page.getByRole("tab", { name: "Manage", exact: true }).click();
  await expect(panel).toBeHidden();
});
