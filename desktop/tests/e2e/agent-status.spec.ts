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
  await panel.getByText("Recent activity (0)").click();
  await expect(
    panel.getByText("No activity received in this client session."),
  ).toBeVisible();
  await waitForAnimations(page);
  await panel.screenshot({ path: "test-results/agent-status/status.png" });
  await page.getByRole("tab", { name: "Manage", exact: true }).click();
  await expect(panel).toBeHidden();
});
