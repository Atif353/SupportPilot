export type GuardFlag = {
  guard: string;
  action: "blocked" | "redacted" | "rewritten" | "flagged";
  detail: string;
};
