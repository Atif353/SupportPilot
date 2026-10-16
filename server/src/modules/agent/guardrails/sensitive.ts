import type { GuardFlag } from "./types.js";

const luhnValid = (digits: string): boolean => {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
};

const patterns: {
  name: string;
  regex: RegExp;
  replacement: string;
  valid?: (m: string) => boolean;
}[] = [
  {
    name: "payment_card",
    regex: /\b(?:\d[ -]?){13,19}\b/g,
    replacement: "[card number removed]",
    valid: (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 13 && digits.length <= 19 && luhnValid(digits);
    },
  },
  { name: "government_id", regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[ID number removed]" },
  {
    name: "api_secret",
    regex: /\b(?:AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,})\b/g,
    replacement: "[secret removed]",
  },
];

/** Removes payment cards (Luhn-checked), ID numbers and API secrets from free text. */
export function redactSensitive(text: string): { text: string; flags: GuardFlag[] } {
  const flags: GuardFlag[] = [];
  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern.regex, (match) => {
      if (pattern.valid && !pattern.valid(match)) return match;
      flags.push({ guard: pattern.name, action: "redacted", detail: "Sensitive data removed" });
      return pattern.replacement;
    });
  }
  return { text: result, flags };
}
