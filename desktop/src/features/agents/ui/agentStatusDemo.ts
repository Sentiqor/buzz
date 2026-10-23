import type { TranscriptItem } from "./agentSessionTypes";

const scenarios = [
  {
    state: "Working",
    activity: [
      "Implementing credential-isolation regression coverage",
      "Regression test reproduced the Windows hook failure",
      "Worker finished reviewing the Git subprocess boundary",
      "Plan agreed in DM: preserve helper reset and signing",
    ],
  },
  {
    state: "Waiting for CI",
    activity: [
      "CI running: 8 of 10 checks passed; next check in one minute",
      "Draft PR updated with the records navigation fix",
      "Browser checks passed for desktop and narrow layouts",
      "Review worker found no remaining blocking findings",
    ],
  },
  {
    state: "Completed",
    activity: [
      "Documentation update complete; delivery summary sent in DM",
      "Authenticated preview verified against the published revision",
      "Deployment completed successfully",
      "Documentation links and build checks passed",
    ],
  },
  {
    state: "Needs your input",
    activity: [
      "Waiting for your approval to deploy the reviewed change",
      "CI passed and independent review completed",
      "Release notes and rollback steps prepared",
      "No deployment started while approval is outstanding",
    ],
  },
];

/** Explicit development-only fixture; never substitutes data in a live session. */
export function getAgentStatusDemo(pubkey: string, startedAt: number) {
  if (!import.meta.env.DEV) return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("e2e") !== "mock" || params.get("demo") !== "agent-status") {
    return null;
  }
  const index = scenarios.findIndex(
    (_, i) => pubkey === (i + 160).toString(16).repeat(32),
  );
  const scenario = scenarios[index];
  if (!scenario) return null;
  const recent: TranscriptItem[] = scenario.activity.map((title, i) => ({
    id: `demo-${index}-${i}`,
    type: "lifecycle",
    renderClass: "status",
    title,
    text: title,
    timestamp: new Date(startedAt - i * 60000).toISOString(),
  }));
  return { state: scenario.state, recent };
}
