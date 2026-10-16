import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, PackageCheck, X } from "lucide-react";
import { apiClient } from "../../shared/api/apiClient";
import { PageHeader } from "../../shared/components/layout/PageHeader";
import { StatusBadge } from "../../shared/components/data-display/StatusBadge";
import { Button } from "../../shared/components/ui/Button";
import { Field, FormError, Select, Textarea } from "../../shared/components/ui/Field";

type ReturnRecord = {
  _id: string;
  returnNumber: string;
  status: string;
  reason: string;
  items: { product: string; quantity: number }[];
  customer?: { email: string; firstName: string; lastName: string };
  order?: { orderNumber: string; items: { product: string; name: string }[] };
  history?: { status: string; notes: string; changedAt: string }[];
};
function ReturnReview({ record }: { record: ReturnRecord }) {
  const cache = useQueryClient();
  const [notes, setNotes] = useState("");
  const actions =
    record.status === "REQUESTED"
      ? ["approve", "reject"]
      : record.status === "APPROVED"
        ? ["receive"]
        : record.status === "RECEIVED"
          ? ["complete"]
          : [];
  const mutation = useMutation({
    mutationFn: (action: string) =>
      apiClient(`/admin/returns/${record._id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, notes }),
      }),
    onSuccess: () => {
      setNotes("");
      void cache.invalidateQueries({ queryKey: ["admin-returns"] });
    },
  });
  return (
    <article className="grid gap-5 rounded-2xl border border-border bg-surface p-5 shadow-card lg:grid-cols-2">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">{record.order?.orderNumber ?? record.returnNumber}</h2>
          <StatusBadge status={record.status} />
        </div>
        <p className="text-sm text-muted">
          {record.customer?.firstName} {record.customer?.lastName} | {record.customer?.email}
        </p>
        {record.items.map((item) => (
          <p className="text-sm" key={item.product}>
            {record.order?.items.find((entry) => entry.product === item.product)?.name ??
              "Returned item"}{" "}
            x {item.quantity}
          </p>
        ))}
        <p className="text-sm">{record.reason}</p>
        {Boolean(record.history?.length) && (
          <details className="text-sm">
            <summary className="text-accent">Request history</summary>
            <ol className="mt-3 space-y-3">
              {record.history?.map((event, index) => (
                <li key={index}>
                  <p className="font-medium">
                    {event.status}{" "}
                    <time className="font-normal text-muted">
                      {new Date(event.changedAt).toLocaleString()}
                    </time>
                  </p>
                  <p>{event.notes}</p>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
      {actions.length > 0 && (
        <div className="space-y-3">
          <Field label="Customer-visible notes">
            <Textarea
              value={notes}
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          <FormError error={mutation.error} />
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                variant={action === "reject" ? "danger" : "primary"}
                disabled={notes.trim().length < 3 || mutation.isPending}
                onClick={() => mutation.mutate(action)}
              >
                {action === "reject" ? (
                  <X className="size-4" />
                ) : action === "receive" ? (
                  <PackageCheck className="size-4" />
                ) : (
                  <Check className="size-4" />
                )}
                {
                  (
                    {
                      approve: "Approve return",
                      reject: "Reject return",
                      receive: "Mark received",
                      complete: "Complete inspection",
                    } as Record<string, string>
                  )[action]
                }
              </Button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
export function ReturnWorkspace() {
  const [status, setStatus] = useState("REQUESTED");
  const query = useQuery({
    queryKey: ["admin-returns", status],
    queryFn: () => apiClient<ReturnRecord[]>(`/admin/returns${status ? `?status=${status}` : ""}`),
    refetchInterval: 15000,
  });
  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Returns"
        description="Customer requests and item inspections"
      />
      <div className="max-w-xs">
        <Field label="Return status">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {["REQUESTED", "APPROVED", "RECEIVED", "COMPLETED", "REJECTED"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </Field>
      </div>
      <FormError error={query.error} />
      {query.isPending && <p className="text-sm text-muted">Loading returns...</p>}
      {query.data?.length === 0 && (
        <p className="py-8 text-sm text-muted">No returns in this queue.</p>
      )}
      {query.data?.map((record) => (
        <ReturnReview key={record._id} record={record} />
      ))}
    </section>
  );
}
