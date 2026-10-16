import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string;
  helper: string;
  icon?: ReactNode;
};

export const MetricCard = ({ label, value, helper, icon }: MetricCardProps): React.ReactElement => (
  <div className="animate-rise rounded-2xl border border-border bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-muted">{label}</p>
      {icon && (
        <span className="grid size-9 place-items-center rounded-xl bg-accentSoft text-accent">
          {icon}
        </span>
      )}
    </div>
    <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    <p className="mt-1 text-sm text-muted">{helper}</p>
  </div>
);
