import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../shared/api/apiClient";
import { PageHeader } from "../../shared/components/layout/PageHeader";
import { StatusBadge } from "../../shared/components/data-display/StatusBadge";
import { CreateTicket } from "../../features/tickets/CreateTicket";
import { FormError } from "../../shared/components/ui/Field";

type RecordPageProps = { title: string; description: string; endpoint: string; empty: string };
type CustomerRecord = {
  _id: string;
  subject?: string;
  returnNumber?: string;
  ticketNumber?: string;
  refundNumber?: string;
  reason?: string;
  category?: string;
  status?: string;
  createdAt?: string;
  resolutionNotes?: string;
  history?: { status: string; notes: string; changedAt: string }[];
};

export const CustomerRecordsPage = ({
  title,
  description,
  endpoint,
  empty,
}: RecordPageProps): React.ReactElement => {
  const query = useQuery({
    queryKey: [endpoint],
    queryFn: () => apiClient<CustomerRecord[]>(endpoint),
    refetchInterval: 15000,
  });
  return (
    <section className="space-y-5">
      <PageHeader eyebrow="Customer workspace" title={title} description={description} />
      {endpoint === "/customer/tickets" && <CreateTicket />}
      <FormError error={query.error} />
      {query.isError ? null : query.isLoading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : !query.data?.length ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-sm text-muted">
          {empty}
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border shadow-card bg-surface">
          {query.data.map((record) => (
            <div
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              key={record._id}
            >
              <div>
                <p className="font-medium">
                  {record.subject ??
                    record.returnNumber ??
                    record.refundNumber ??
                    record.ticketNumber}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {record.reason ?? record.category} ·{" "}
                  {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : ""}
                </p>
                {record.resolutionNotes && <p className="mt-2 text-sm">{record.resolutionNotes}</p>}
                {Boolean(record.history?.length) && (
                  <details className="mt-3 text-sm">
                    <summary className="text-accent">Request history</summary>
                    <ol className="mt-2 space-y-2">
                      {record.history?.map((event, index) => (
                        <li key={index}>
                          <p className="font-medium">
                            {event.status}{" "}
                            <time className="font-normal text-muted">
                              {new Date(event.changedAt).toLocaleDateString()}
                            </time>
                          </p>
                          <p>{event.notes}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
              {record.status && <StatusBadge status={record.status} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
