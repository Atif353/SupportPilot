import { cn } from "../../utils/cn";

type Tone = "success" | "danger" | "warning" | "info" | "neutral";

const tones: Record<Tone, { badge: string; dot: string }> = {
  success: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", dot: "bg-emerald-500" },
  danger: { badge: "bg-red-50 text-red-700 ring-red-600/15", dot: "bg-red-500" },
  warning: { badge: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  info: { badge: "bg-indigo-50 text-indigo-700 ring-indigo-600/15", dot: "bg-indigo-500" },
  neutral: { badge: "bg-slate-100 text-slate-600 ring-slate-500/15", dot: "bg-slate-400" },
};

export function statusTone(status: string): Tone {
  if (/CANCEL|REJECT|FAIL|DENIED/.test(status)) return "danger";
  if (/DELIVER|COMPLET|APPROV|RESOLV|READY|PUBLISHED|PAID/.test(status)) return "success";
  if (/WAIT|PENDING|REQUEST|QUEUED|REVIEW|PROCESSING|INDEXING/.test(status)) return "warning";
  if (/OPEN|PROGRESS|RECEIVED|SHIPPED|TRANSIT|RUNNING/.test(status)) return "info";
  return "neutral";
}

export const StatusBadge = ({ status }: { status: string }): React.ReactElement => {
  const tone = tones[statusTone(status)];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        tone.badge,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden="true" />
      {status.replaceAll("_", " ")}
    </span>
  );
};
