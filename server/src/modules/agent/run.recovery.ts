import { logger } from "../../config/logger.js";
import { AgentTrace } from "../models/agent-trace.model.js";
import { Conversation } from "../models/conversation.model.js";

/**
 * Repairs state left behind when the API stopped mid-run: traces still marked RUNNING are
 * failed so they stop looking in-flight, and expired conversation leases are released so
 * customers are never locked out of their own conversation.
 */
export async function recoverInterruptedRuns(
  staleAfterMs = 5 * 60_000,
  now = new Date(),
): Promise<{ runs: number; leases: number }> {
  const cutoff = new Date(now.getTime() - staleAfterMs);
  const runs = await AgentTrace.updateMany(
    { status: "RUNNING", startedAt: { $lt: cutoff } },
    {
      status: "FAILED",
      error: "Run interrupted before completion.",
      completedAt: now,
    },
  );
  const leases = await Conversation.updateMany(
    { agentLeaseUntil: { $lt: now } },
    { $unset: { agentLeaseUntil: 1 } },
  );
  if (runs.modifiedCount || leases.modifiedCount)
    logger.warn(
      { runs: runs.modifiedCount, leases: leases.modifiedCount },
      "Recovered interrupted agent runs",
    );
  return { runs: runs.modifiedCount, leases: leases.modifiedCount };
}
