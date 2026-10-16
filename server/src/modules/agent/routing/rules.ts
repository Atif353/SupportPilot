export type AgentIntent = "ORDER" | "POLICY" | "RETURN" | "REFUND" | "CANCEL" | "HUMAN" | "GENERAL";

export const agentIntents: readonly AgentIntent[] = [
  "ORDER",
  "POLICY",
  "RETURN",
  "REFUND",
  "CANCEL",
  "HUMAN",
  "GENERAL",
];

/** High-precision keyword routing. Returns null when no rule applies so a model can decide. */
export function matchIntent(message: string): AgentIntent | null {
  const text = message.toLowerCase();
  if (/\b(human|person|representative|support agent)\b/.test(text)) return "HUMAN";
  if (/\b(policy|policies|window|eligible|eligibility)\b/.test(text)) return "POLICY";
  if (/\brefund\b/.test(text)) return "REFUND";
  if (/\breturns?\b/.test(text)) return "RETURN";
  if (/\bcancel\b/.test(text)) return "CANCEL";
  // A bare "order" is ambiguous ("call off the order"), so only unambiguous order words match.
  if (
    /\b(track|tracking|arriv\w*|deliver\w*|shipment|shipped|parcel|package|courier|turned up|status)\b/.test(
      text,
    )
  )
    return "ORDER";
  if (/\bmy (latest |recent |last |current )?orders?\b/.test(text)) return "ORDER";
  return null;
}

export function classifyIntent(message: string): AgentIntent {
  return matchIntent(message) ?? "GENERAL";
}
