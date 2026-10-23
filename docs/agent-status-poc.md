# Agent status overview POC

This desktop prototype adds **Agents > Status**, alongside the existing Manage
tab. It explores a lead overview with objectives, next steps, coloured status
labels, multiple workers, and expandable subagents.

## Preview

Install workspace dependencies with `pnpm install --frozen-lockfile`, then run
`pnpm --dir desktop dev`. Open the development server URL with
`?e2e=mock&demo=agent-status` and choose **Agents > Status**.

The preview uses fictional agents and activity. It requires no real identity,
credentials, relay connection, or local agent configuration. Demo activation is
limited to development mode; it is not enabled by a URL in a production build.

## Scope and limitations

- The opt-in demo hierarchy and task summaries are fixtures.
- Outside the demo, the tab uses the current identity's owned relay agents and
  existing observer activity. Missing or old signals are shown as unknown.
- The live view separates actual worker indices, reads ACP plans for objectives,
  and nests explicit delegate tool calls beneath the worker that launched them.
  Background launch results do not prove completion: correlated adapter async
  lifecycle events must report it. Unreported subagents remain unknown.
- `buzz agents status` publishes bounded, owner-encrypted task summaries through
  the existing observer feed. The harness adds the worker index, turn ID, and
  reporting instructions to observed turns. Task stages are agent reports, not
  independent verification of CI or deployment. A finished turn is not proof of
  completed delivery.
- This branch does not configure fork-specific installers, signing, or updates.
  Configure an independent application identity and update channel before
  distributing fork builds.

## Using live activity

Build the desktop, `buzz-acp`, and `buzz-cli` from this branch. Run the updated
harness with `--relay-observer`, its existing owner configuration and credentials,
and ensure its subprocess PATH resolves the updated `buzz` CLI. Open the desktop
with the owning identity on the same relay, then choose **Agents > Status**.
Channels are not required for owned-agent discovery or DM activity. Updating
source does not update installed binaries or restart running agents.

Existing observer-enabled harnesses can supply lifecycle and ACP-plan activity;
the updated harness and CLI add explicit task-stage reporting. The injected
command uses the actual zero-based worker index and UUID for that turn:

```sh
buzz agents status --worker 0 --turn <turn-uuid> --stage testing --task 'Validate navigation' --next 'Review test results'
```

Stages: `working`, `testing`, `reviewing`, `waiting_ci`, `waiting_approval`,
`blocked`, `completed`, `available`. Task and next-action fields are limited to
300 characters. The CLI requires the existing agent owner attestation and
publishes encrypted telemetry only to that owner. Never include secrets in
summaries. Rejection and publication errors return failure.

Disconnected or inactive telemetry becomes unknown after 60 seconds; explicit
stage reports also expire after two minutes independently of lifecycle pings.
Refresh reports during existing work or monitoring passes, not new polling loops.
Only observed workers are shown. The bounded session window is not a durable task
ledger; background children from an older worker turn are not tracked across a
new turn. Adapter support determines which subagent lifecycle events exist.

The focused smoke test is `desktop/tests/e2e/agent-status.spec.ts`; it checks
owner filtering, DM-only discovery, missing telemetry, concurrent workers,
reported stages, nested subagents, and switching tabs using seeded observer data.
Build with `pnpm --dir desktop build:e2e` before running the smoke test.
Projection regressions are in `agentLiveStatus.test.mjs`; CLI tests verify owner
encryption and input bounds. These checks do not certify an installed live relay
or native desktop build.

Only generic UI code, synthetic fixture data, tests, and this document belong
in this change. Never commit real activity logs, credentials, local agent
configuration, or private project documents to this public repository.
