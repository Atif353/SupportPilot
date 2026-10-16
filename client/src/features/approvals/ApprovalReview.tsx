import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { apiClient } from "../../shared/api/apiClient";
import { PageHeader } from "../../shared/components/layout/PageHeader";
import { StatusBadge } from "../../shared/components/data-display/StatusBadge";
import { Button } from "../../shared/components/ui/Button";
import { Field, FormError, Textarea } from "../../shared/components/ui/Field";

type Approval = {
  _id: string;
  requestType: string;
  status: string;
  createdAt: string;
  decisionNotes?: string;
  payload: Record<string, string>;
  order?: { orderNumber: string };
  requestedBy?: { email: string };
};
function Review({ approval }: { approval: Approval }) {
  const cache = useQueryClient();
  const [notes, setNotes] = useState("");
  const mutation = useMutation({
    mutationFn: (decision: "APPROVED" | "REJECTED") =>
      apiClient(`/admin/approvals/${approval._id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision, notes }),
      }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["approvals"] }),
  });
  return (
    <article className="grid gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card md:grid-cols-[1fr_1fr]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">
            {approval.requestType} {approval.order?.orderNumber}
          </h2>
          <StatusBadge status={approval.status} />
        </div>
        <p className="text-sm">
          {approval.payload?.currency} {approval.payload?.amount}
        </p>
        <p className="text-sm">{approval.payload?.reason}</p>
        <p className="text-xs text-muted">
          {approval.requestedBy?.email} | {new Date(approval.createdAt).toLocaleString()}
        </p>
        {approval.decisionNotes && <p className="text-sm">{approval.decisionNotes}</p>}
      </div>
      {approval.status === "PENDING" && (
        <div className="space-y-3">
          <Field label="Decision reason">
            <Textarea
              minLength={3}
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          <FormError error={mutation.error} />
          <div className="flex gap-2">
            <Button
              busy={mutation.isPending}
              disabled={notes.trim().length < 3}
              onClick={() => mutation.mutate("APPROVED")}
            >
              <Check className="size-4" />
              Approve
            </Button>
            <Button
              variant="danger"
              disabled={mutation.isPending || notes.trim().length < 3}
              onClick={() => mutation.mutate("REJECTED")}
            >
              <X className="size-4" />
              Reject
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
export function ApprovalReview() {
  const query = useQuery({
    queryKey: ["approvals"],
    queryFn: () => apiClient<Approval[]>("/admin/approvals"),
    refetchInterval: 10000,
  });
  return (
    <section className="space-y-5">
      <PageHeader eyebrow="Operations" title="Approvals" description="Pending refund reviews" />
      <FormError error={query.error} />
      {query.isLoading && <p className="py-6 text-sm">Loading approvals...</p>}
      {query.data?.length === 0 && (
        <p className="py-8 text-sm text-muted">No approvals to review.</p>
      )}
      {query.data?.map((approval) => (
        <Review key={approval._id} approval={approval} />
      ))}
    </section>
  );
}
