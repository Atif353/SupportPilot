import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bot,
  ClipboardCheck,
  FileText,
  Inbox,
  ListTodo,
  RotateCcw,
  ArrowUpRight,
} from "lucide-react";
import { MetricCard } from "../../shared/components/data-display/MetricCard";
import { PageHeader } from "../../shared/components/layout/PageHeader";
import { apiClient } from "../../shared/api/apiClient";

type Metrics = { conversations: number; approvals: number; traces: number; tickets: number };

const shortcuts = [
  {
    to: "/admin/conversations",
    label: "Review conversations",
    hint: "Claim, reply and resolve",
    icon: Inbox,
  },
  {
    to: "/admin/approvals",
    label: "Decide approvals",
    hint: "Refunds waiting on staff",
    icon: ClipboardCheck,
  },
  {
    to: "/admin/returns",
    label: "Process returns",
    hint: "Approve, receive, inspect",
    icon: RotateCcw,
  },
  {
    to: "/admin/knowledge",
    label: "Manage knowledge",
    hint: "Policies the agent cites",
    icon: FileText,
  },
  { to: "/admin/ai-runs", label: "Inspect AI runs", hint: "Traces, tools and latency", icon: Bot },
  { to: "/admin/tickets", label: "Work tickets", hint: "Update ticket status", icon: ListTodo },
];

export const AdminDashboardPage = (): React.ReactElement => {
  const query = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => apiClient<Metrics>("/admin/metrics"),
  });
  const metrics = query.data ?? { conversations: 0, approvals: 0, traces: 0, tickets: 0 };
  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Admin dashboard"
        description="Live support activity, approvals, traces, and proactive cases."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Conversations",
            value: metrics.conversations,
            helper: "Persistent support threads",
            icon: <Inbox className="size-5" />,
          },
          {
            label: "Pending approvals",
            value: metrics.approvals,
            helper: "Awaiting manager decision",
            icon: <ClipboardCheck className="size-5" />,
          },
          {
            label: "Agent traces",
            value: metrics.traces,
            helper: "Recorded AI runs",
            icon: <Bot className="size-5" />,
          },
          {
            label: "Open tickets",
            value: metrics.tickets,
            helper: "Including proactive cases",
            icon: <ListTodo className="size-5" />,
          },
        ].map((metric) => (
          <MetricCard key={metric.label} {...metric} value={String(metric.value)} />
        ))}
      </div>
      <div>
        <h2 className="text-base font-semibold">Jump back in</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map(({ to, label, hint, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-pop"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accentSoft text-accent">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-sm text-muted">{hint}</span>
              </span>
              <ArrowUpRight
                className="size-4 text-muted transition group-hover:text-accent"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
