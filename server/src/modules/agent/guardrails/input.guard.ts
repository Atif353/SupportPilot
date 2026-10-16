import { redactSensitive } from "./sensitive.js";
import type { GuardFlag } from "./types.js";

export type InputVerdict = {
  allowed: boolean;
  message: string;
  flags: GuardFlag[];
  refusal?: string;
};

/** Attempts to extract the hidden instructions or switch the assistant's persona: refused. */
const extraction =
  /\b(?:reveal|show|print|repeat|leak|tell me|output)\b[^.?!]{0,40}\b(?:system prompt|your (?:hidden |initial )?instructions|developer message)\b|\b(?:jailbreak|developer mode|DAN mode)\b|\byou are now\b[^.?!]{0,30}\b(?:unrestricted|unfiltered|without (?:rules|restrictions))/i;

/** Instruction-override attempts: allowed through but flagged, since the model treats user text as data. */
const override =
  /\b(?:ignore|disregard|forget|override)\b[^.?!]{0,30}\b(?:previous|prior|above|all|any|your|the)\b[^.?!]{0,20}\b(?:instructions?|rules?|guidelines?|policy|policies|restrictions?)\b/i;

export const inputRefusal =
  "I can't help with that request. I can answer questions about your orders and our store policies, or connect you with a support agent.";

/**
 * First line of defence, run before any model sees the message. Sensitive data is redacted,
 * extraction attempts are refused, and instruction overrides are flagged for the trace.
 */
export function checkInput(message: string): InputVerdict {
  const { text, flags } = redactSensitive(message);
  if (extraction.test(text))
    return {
      allowed: false,
      message: text,
      flags: [
        ...flags,
        { guard: "prompt_extraction", action: "blocked", detail: "Instruction extraction refused" },
      ],
      refusal: inputRefusal,
    };
  if (override.test(text))
    flags.push({
      guard: "prompt_injection",
      action: "flagged",
      detail: "Instruction override attempt; message handled as untrusted data",
    });
  return { allowed: true, message: text, flags };
}

export const sensitiveDataNotice =
  "I removed what looked like a card number or ID from your message. Please never share payment details or passwords in chat; staff will never ask for them.";
