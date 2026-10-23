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

- The hierarchy, objectives, workflow stages, and summary counts are fixtures.
- Outside the demo, the tab uses the current identity's owned relay agents and
  existing observer activity. Missing or old signals are shown as unknown.
- Live worker/subagent relationships and structured task status hooks are not
  implemented. A finished turn is not proof of completed delivery.
- This branch does not configure fork-specific installers, signing, or updates.
  Configure an independent application identity and update channel before
  distributing fork builds.

The focused smoke test is `desktop/tests/e2e/agent-status.spec.ts`; it checks
owner filtering, DM-only discovery, missing telemetry, and switching tabs.
Build with `pnpm --dir desktop build:e2e` before running the smoke test.

Only generic UI code, synthetic fixture data, tests, and this document belong
in this change. Never commit real activity logs, credentials, local agent
configuration, or private project documents to this public repository.
