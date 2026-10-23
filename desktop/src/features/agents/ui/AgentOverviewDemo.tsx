type WorkStatus =
  | "Working"
  | "Waiting for CI"
  | "Completed"
  | "Needs approval"
  | "Available";
type Work = {
  name: string;
  task: string;
  status: WorkStatus;
  subagents: { name: string; task: string; status: WorkStatus }[];
};
const leads: {
  name: string;
  objective: string;
  summary: string;
  status: WorkStatus;
  next: string;
  workers: Work[];
}[] = [
  {
    name: "Gateway",
    objective: "Make integrations reliable on Windows",
    summary:
      "Hook fix is in validation. Connector coverage is progressing alongside it.",
    status: "Working",
    next: "Finish regression checks, then hand the fix to review.",
    workers: [
      {
        name: "Worker 1",
        task: "Fix Git hook environment propagation",
        status: "Working",
        subagents: [
          {
            name: "Implementation",
            task: "Preserve empty credential-helper settings",
            status: "Completed",
          },
          {
            name: "Verifier",
            task: "Exercise commit and push with hooks enabled",
            status: "Working",
          },
        ],
      },
      {
        name: "Worker 2",
        task: "Expand connector error-handling coverage",
        status: "Working",
        subagents: [
          {
            name: "Test author",
            task: "Cover retries and tenant isolation",
            status: "Working",
          },
          {
            name: "Reviewer",
            task: "Review failure-path behaviour",
            status: "Completed",
          },
        ],
      },
      {
        name: "Worker 3",
        task: "Ready for the next agreed task",
        status: "Available",
        subagents: [],
      },
    ],
  },
  {
    name: "Knowledge",
    objective: "Make records easier to navigate",
    summary:
      "The navigation change is ready. CI is the remaining check before final review.",
    status: "Waiting for CI",
    next: "Reconcile the final two CI checks and report the result.",
    workers: [
      {
        name: "Worker 1",
        task: "Deliver full-page record navigation",
        status: "Waiting for CI",
        subagents: [
          {
            name: "UI implementer",
            task: "Preserve record context and back navigation",
            status: "Completed",
          },
          {
            name: "Browser verifier",
            task: "Check keyboard and narrow-screen flows",
            status: "Completed",
          },
        ],
      },
      {
        name: "Worker 2",
        task: "Review nested record relationships",
        status: "Working",
        subagents: [
          {
            name: "Reviewer",
            task: "Check parent and dependency links",
            status: "Working",
          },
        ],
      },
      {
        name: "Worker 3",
        task: "Ready for the next agreed task",
        status: "Available",
        subagents: [],
      },
    ],
  },
  {
    name: "Docs",
    objective: "Publish the updated onboarding guide",
    summary:
      "The guide is published and the authenticated preview has been checked.",
    status: "Completed",
    next: "Delivery complete. Ready for your next plan.",
    workers: [
      {
        name: "Worker 1",
        task: "Write and publish onboarding guidance",
        status: "Completed",
        subagents: [
          {
            name: "Editor",
            task: "Check instructions against the product",
            status: "Completed",
          },
          {
            name: "Verifier",
            task: "Validate links and published content",
            status: "Completed",
          },
        ],
      },
      {
        name: "Worker 2",
        task: "Ready for the next agreed task",
        status: "Available",
        subagents: [],
      },
      {
        name: "Worker 3",
        task: "Ready for the next agreed task",
        status: "Available",
        subagents: [],
      },
    ],
  },
  {
    name: "Platform",
    objective: "Prepare the next platform release",
    summary:
      "Review and CI are complete. Deployment is waiting for your decision.",
    status: "Needs approval",
    next: "Your decision needed: approve the prepared deployment.",
    workers: [
      {
        name: "Worker 1",
        task: "Prepare and validate the release",
        status: "Needs approval",
        subagents: [
          {
            name: "Release reviewer",
            task: "Review changes and CI evidence",
            status: "Completed",
          },
          {
            name: "Operations verifier",
            task: "Check rollback and release steps",
            status: "Completed",
          },
        ],
      },
      {
        name: "Worker 2",
        task: "Investigate background job reliability",
        status: "Working",
        subagents: [
          {
            name: "Investigator",
            task: "Trace retry behaviour",
            status: "Working",
          },
        ],
      },
      {
        name: "Worker 3",
        task: "Ready for the next agreed task",
        status: "Available",
        subagents: [],
      },
    ],
  },
];

const colors: Record<string, string> = {
  Testing:
    "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700",
  Reviewing:
    "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-700",
  Blocked:
    "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700",
  Failed:
    "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-700",
  Working:
    "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700",
  "Waiting for CI":
    "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-700",
  Completed:
    "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700",
  "Needs approval":
    "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700",
};

/** Status always has a readable label as well as a colour. */
export function AgentStatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${colors[status] ?? "bg-muted text-muted-foreground border-border"}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current"
      />
      {status}
    </span>
  );
}

/** Fictional hierarchy for reviewing the overview before live telemetry wiring. */
export function AgentOverviewDemo() {
  const workers = leads.flatMap((lead) => lead.workers);
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Leads", leads.length],
          [
            "Workers in progress",
            workers.filter(
              (w) => w.status === "Working" || w.status === "Waiting for CI",
            ).length,
          ],
          [
            "Subagents working",
            workers
              .flatMap((w) => w.subagents)
              .filter((s) => s.status === "Working").length,
          ],
          [
            "Needs your input",
            leads.filter((l) => l.status === "Needs approval").length,
          ],
        ].map(([label, count]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{count}</dd>
          </div>
        ))}
      </dl>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {leads.map((lead) => (
          <article
            key={lead.name}
            className="min-w-0 overflow-hidden rounded-xl border bg-card"
          >
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{lead.name} Lead</h3>
                <AgentStatusPill status={lead.status} />
              </div>
              <h4 className="text-lg font-semibold">{lead.objective}</h4>
              <p className="text-sm text-muted-foreground">{lead.summary}</p>
              <p
                className={`rounded-lg border p-3 text-sm ${lead.status === "Needs approval" ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100" : "bg-muted/40"}`}
              >
                <span className="font-medium">Next: </span>
                {lead.next}
              </p>
            </div>
            <div className="border-t px-5 py-3 text-xs font-medium text-muted-foreground">
              {lead.workers.length} workers ·{" "}
              {lead.workers.flatMap((w) => w.subagents).length} subagents
            </div>
            <ul className="divide-y border-t">
              {lead.workers.map((worker) => (
                <li key={worker.name} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {worker.name}
                    </span>
                    <AgentStatusPill status={worker.status} />
                  </div>
                  <p className="text-sm font-medium">{worker.task}</p>
                  {worker.subagents.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer rounded py-1 text-muted-foreground focus-visible:outline focus-visible:outline-2">
                        {worker.subagents.length} subagents ·{" "}
                        {
                          worker.subagents.filter(
                            (s) => s.status === "Completed",
                          ).length
                        }{" "}
                        completed
                      </summary>
                      <ul className="ml-2 mt-2 space-y-3 border-l-2 pl-3">
                        {worker.subagents.map((sub) => (
                          <li key={sub.name}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">{sub.name}</span>
                              <AgentStatusPill status={sub.status} />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {sub.task}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
