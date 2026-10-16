const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];
const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function timeValue(value: unknown): number {
  const time = typeof value === "string" || value instanceof Date ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}

export function relativeTime(value: unknown, now = Date.now()): string {
  const time = timeValue(value);
  if (!time) return "";
  const diff = time - now;
  if (diff > -60_000) return "just now";
  for (const [unit, size] of units)
    if (Math.abs(diff) >= size) return formatter.format(Math.round(diff / size), unit);
  return "just now";
}

export function initials(first: unknown, last?: unknown): string {
  return `${String(first ?? "").charAt(0)}${String(last ?? "").charAt(0)}`.toUpperCase() || "?";
}
