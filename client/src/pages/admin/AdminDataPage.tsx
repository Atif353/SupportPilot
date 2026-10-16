import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ChevronRight, Inbox, Search } from "lucide-react";
import { apiClient } from "../../shared/api/apiClient";
import { StatusBadge } from "../../shared/components/data-display/StatusBadge";
import { PageHeader } from "../../shared/components/layout/PageHeader";
import { FormError, Select } from "../../shared/components/ui/Field";
import { initials, relativeTime, timeValue } from "../../shared/utils/time";

type AdminDataPageProps = { title: string; description: string; endpoint: string; label: string };
type Person = { firstName?: string; lastName?: string; email?: string };
type Row = { _id: string; [key: string]: unknown };

const personName = (value: unknown): string => {
  if (!value || typeof value !== "object") return "";
  const person = value as Person;
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email || "";
};

/** Most recent activity first; rows without a usable date sort last. */
export const recencyOf = (row: Row): number => {
  const limit = Date.now() + 60_000;
  const times = [row.lastMessageAt, row.updatedAt, row.createdAt]
    .map(timeValue)
    .filter((time) => time <= limit);
  return Math.max(0, ...times);
};

export const sortNewestFirst = (rows: Row[]): Row[] =>
  [...rows].sort((left, right) => recencyOf(right) - recencyOf(left));

export const AdminDataPage = ({
  title,
  description,
  endpoint,
  label,
}: AdminDataPageProps): React.ReactElement => {
  const [filter, setFilter] = useState("");
  const query = useQuery({
    queryKey: [endpoint],
    queryFn: () => apiClient<Row[] | Record<string, number>>(endpoint),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient(`/admin/tickets/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      void query.refetch();
    },
  });
  const rows = useMemo<Row[]>(() => {
    if (Array.isArray(query.data)) return sortNewestFirst(query.data);
    return Object.entries(query.data ?? {}).map(([key, value]) => ({
      _id: key,
      title: key,
      description: String(value),
    }));
  }, [query.data]);
  const visible = useMemo(
    () => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(filter.toLowerCase())),
    [rows, filter],
  );
  const isConversations = endpoint === "/admin/conversations";
  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Operations" title={title} description={description} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            aria-label={`Filter ${label}`}
            placeholder={`Filter ${label}`}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-3.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
          />
        </div>
        {!query.isLoading && (
          <p className="text-sm text-muted">
            {visible.length} of {rows.length} {label}
            {Array.isArray(query.data) && " · newest first"}
          </p>
        )}
      </div>
      <FormError error={query.error ?? update.error} />
      {query.isLoading ? (
        <div className="space-y-3" role="status" aria-label={`Loading ${label}`}>
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-20 shimmer rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
          <Inbox className="size-8 text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">No records found.</p>
          <p className="text-sm text-muted">Try a different filter.</p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          {visible.map((row, index) => {
            const customer = personName(row.customer);
            const assignee = personName(row.assignedTo);
            const when = relativeTime(row.lastMessageAt ?? row.updatedAt ?? row.createdAt);
            const heading = String(
              row.subject ?? row.title ?? row.name ?? row.orderNumber ?? row.email ?? row._id,
            );
            const subline = isConversations
              ? [customer, assignee ? `Assigned to ${assignee}` : "Unassigned"]
                  .filter(Boolean)
                  .join(" · ")
              : String(row.description ?? row.category ?? "");
            const content = (
              <>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accentSoft text-xs font-semibold text-accent">
                  {initials(customer.split(" ")[0] ?? heading, customer.split(" ")[1])}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{heading}</p>
                  {subline && <p className="mt-0.5 truncate text-sm text-muted">{subline}</p>}
                </div>
              </>
            );
            return (
              <motion.div
                className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-mutedSurface/60"
                key={row._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 12) * 0.03, duration: 0.25 }}
              >
                {isConversations ? (
                  <Link
                    className="flex min-w-0 flex-1 items-center gap-4"
                    to={`/admin/conversations/${row._id}`}
                    aria-label={`Open conversation ${heading}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-4">{content}</div>
                )}
                {when && <span className="text-xs text-muted">{when}</span>}
                {typeof row.status === "string" && <StatusBadge status={row.status} />}
                {endpoint === "/admin/tickets" && (
                  <Select
                    className="max-w-44"
                    aria-label={`Status of ${String(row.ticketNumber)}`}
                    disabled={update.isPending}
                    value={String(row.status)}
                    onChange={(event) => update.mutate({ id: row._id, status: event.target.value })}
                  >
                    {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </Select>
                )}
                {isConversations && (
                  <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                )}
                {endpoint === "/admin/traces" && (
                  <details className="w-full text-xs">
                    <summary className="font-medium text-accent">Run details</summary>
                    <p className="mt-2">
                      Model: {String(row.model ?? "Not recorded")} | {String(row.latencyMs ?? 0)}ms
                    </p>
                    <pre className="scroll-thin mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-mutedSurface p-3">
                      {JSON.stringify(
                        {
                          error: row.error,
                          graphNodes: row.graphNodes,
                          spans: row.spans,
                          tokenUsage: row.tokenUsage,
                          output: row.output,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
};
