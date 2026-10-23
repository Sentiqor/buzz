import * as React from "react";
import { useIdentityQuery } from "@/shared/api/hooks";
import type { RelayAgent } from "@/shared/api/types";
import { Button } from "@/shared/ui/button";
import { useRelayAgentsQuery } from "../hooks";
import { useAgentWorking } from "../agentWorkingSignal";
import { normalizePubkey } from "@/shared/lib/pubkey";
import { useObserverEvents, useAgentTranscript } from "./useObserverEvents";
import { getAgentStatusDemo } from "./agentStatusDemo";
import { AgentOverviewDemo, AgentStatusPill } from "./AgentOverviewDemo";

function StatusCard({ agent }: { agent: RelayAgent }) {
  const working = useAgentWorking(agent.pubkey);
  const observer = useObserverEvents(true, agent.pubkey);
  const transcript = useAgentTranscript(true, agent.pubkey);
  const [now, setNow] = React.useState(Date.now);
  const [demoStartedAt] = React.useState(Date.now);
  const demo = getAgentStatusDemo(agent.pubkey, demoStartedAt);
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const latest = observer.events.at(-1);
  const age = latest ? Math.max(0, now - Date.parse(latest.timestamp)) : null;
  const fresh = age !== null && Number.isFinite(age) && age < 60000;
  const state =
    demo?.state ??
    (!fresh
      ? "Status unknown"
      : working.working
        ? "Working"
        : "No active turn observed");
  const recent =
    demo?.recent ??
    transcript
      .filter((item) => item.type !== "thought" && item.type !== "metadata")
      .slice(-6)
      .reverse();
  return (
    <article className="min-w-0 rounded-xl border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-base">{agent.name || "Agent"}</h3>
        <AgentStatusPill status={state} />
      </div>
      <p className="text-sm break-words">
        {recent[0]?.title ?? "Waiting for activity telemetry"}
      </p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Presence</dt>
          <dd>{demo ? "Simulated" : agent.status}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Activity stream</dt>
          <dd>{demo ? "Demo snapshot" : observer.connectionState}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Working conversations</dt>
          <dd>
            {demo
              ? demo.state === "Working"
                ? 1
                : 0
              : fresh
                ? working.channels.length
                : "Unknown"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last signal</dt>
          <dd>
            {demo
              ? "Sample activity"
              : age !== null && Number.isFinite(age)
                ? `${Math.floor(age / 1000)}s ago`
                : "Not received"}
          </dd>
        </div>
      </dl>
      {observer.errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          Activity unavailable. Reconnect to refresh.
        </p>
      ) : null}
      <details className="text-sm" open={demo ? true : undefined}>
        <summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2">
          Recent activity ({recent.length})
        </summary>
        <ol className="mt-3 space-y-3">
          {recent.map((item) => (
            <li key={item.id} className="border-l-2 pl-3 break-words">
              <p>{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.type === "tool" ? `${item.status} · ` : ""}
                {new Date(item.timestamp).toLocaleTimeString()}
              </p>
            </li>
          ))}
        </ol>
        {recent.length === 0 ? (
          <p className="mt-3 text-muted-foreground">
            No activity received in this client session.
          </p>
        ) : null}
      </details>
      <p className="text-xs text-muted-foreground">
        Subagent and workflow trees are not yet available in this proof of
        concept.
      </p>
    </article>
  );
}

/** Owner-scoped overview using the existing encrypted observer stream. */
export function AgentStatusView() {
  const identity = useIdentityQuery();
  const query = useRelayAgentsQuery();
  const owner = identity.data?.pubkey;
  const agents = (query.data ?? []).filter(
    (agent) =>
      owner &&
      agent.ownerPubkey &&
      normalizePubkey(agent.ownerPubkey) === normalizePubkey(owner),
  );
  return (
    <section aria-label="Agent status" className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Your agents, at a glance</h2>
          <p className="text-sm text-muted-foreground">
            {agents.some((agent) => getAgentStatusDemo(agent.pubkey, 0))
              ? "Demo only — fictional activity illustrating the status view, not your agents’ live progress."
              : "Live activity from your owned agents, including DMs. Signals older than one minute are marked unknown."}
          </p>
        </div>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Refresh directory
        </Button>
      </div>
      {query.isError || identity.isError ? (
        <p role="alert">
          Unable to load agents. Retry refreshing the directory.
        </p>
      ) : query.isLoading || identity.isLoading ? (
        <p role="status">Loading agents…</p>
      ) : agents.length === 0 ? (
        <p>No owned agents found in this community.</p>
      ) : agents.some((agent) => getAgentStatusDemo(agent.pubkey, 0)) ? (
        <AgentOverviewDemo />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((agent) => (
            <StatusCard key={agent.pubkey} agent={agent} />
          ))}
        </div>
      )}
    </section>
  );
}
