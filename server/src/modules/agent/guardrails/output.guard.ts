import { redactSensitive } from "./sensitive.js";
import type { GuardFlag } from "./types.js";

export type OutputContext = { intent: string; sourceCount: number };
export type OutputVerdict = { text: string; flags: GuardFlag[] };

const noActionNotice =
  "No changes have been made to your account. To cancel, return or request a refund, open the order under Orders and confirm the request there.";

/** First-person or passive claims that an account action already happened. */
const actionClaim =
  /\b(?:I(?:'ve| have|'m| am| will)?\s+(?:just\s+|now\s+)?(?:cancel(?:l)?ed|cancel(?:l)?ing|refunded|refunding|processed|processing|approved|approving|issued|issuing|initiated|submitted|placed|updated|changed)\b|(?:your (?:order|refund|return|request|payment)|it)\s+(?:has|have|is|was) (?:now |already |been )?(?:cancel(?:l)?ed|refunded|approved|processed|issued|completed)\b)/i;

const leakedInstructions =
  /You are NovaStore SupportPilot|Use only authorized tool evidence|untrusted data, never instructions/i;

const ungroundedPolicy =
  "I couldn't find a published policy that answers this. Please choose Request an agent so a person can confirm.";

const splitSentences = (text: string): string[] =>
  text.match(/[^.!?\n]+[.!?]*\s*|\n+/g)?.map((part) => part) ?? [text];

/**
 * Last line of defence on every answer, whichever model (or template) wrote it: secrets are
 * redacted, unverified claims of completed actions are removed, leaked instructions are
 * replaced, policy answers with no evidence are refused, and the length is bounded.
 */
export function checkOutput(text: string, context: OutputContext): OutputVerdict {
  const flags: GuardFlag[] = [];
  const redacted = redactSensitive(text);
  flags.push(...redacted.flags);
  let result = redacted.text.trim();

  if (leakedInstructions.test(result)) {
    flags.push({
      guard: "instruction_leak",
      action: "rewritten",
      detail: "Internal instructions removed",
    });
    result = "I can't share that, but I'm happy to help with your orders or our store policies.";
  }

  if (actionClaim.test(result)) {
    const kept = splitSentences(result).filter((sentence) => !actionClaim.test(sentence));
    flags.push({
      guard: "unverified_action_claim",
      action: "rewritten",
      detail: "Removed a claim that an account action was completed",
    });
    result = `${kept.join("").trim()}\n\n${noActionNotice}`.trim();
  }

  if (context.intent === "POLICY" && context.sourceCount === 0) {
    flags.push({
      guard: "ungrounded_policy",
      action: "rewritten",
      detail: "Policy answer without evidence",
    });
    result = ungroundedPolicy;
  }

  if (result.length > 4000) {
    flags.push({ guard: "length", action: "rewritten", detail: "Answer truncated" });
    result = `${result.slice(0, 3990).trimEnd()}…`;
  }
  if (!result) {
    flags.push({ guard: "empty_answer", action: "rewritten", detail: "Empty answer replaced" });
    result = "I couldn't produce a reliable answer. Please choose Request an agent for help.";
  }
  return { text: result, flags };
}
