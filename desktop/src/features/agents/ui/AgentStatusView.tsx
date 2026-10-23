import { useIdentityQuery } from "@/shared/api/hooks";
import { Button } from "@/shared/ui/button";
import { useRelayAgentsQuery } from "../hooks";
import { normalizePubkey } from "@/shared/lib/pubkey";
import { getAgentStatusDemo } from "./agentStatusDemo";
import { AgentOverviewDemo } from "./AgentOverviewDemo";
import { LiveAgentOverview } from "./LiveAgentOverview";

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
            <LiveAgentOverview key={agent.pubkey} agent={agent} />
          ))}
        </div>
      )}
    </section>
  );
}
