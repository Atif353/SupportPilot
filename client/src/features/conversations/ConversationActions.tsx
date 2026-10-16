import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, UserCheck } from "lucide-react";
import { apiClient } from "../../shared/api/apiClient";
import { Button } from "../../shared/components/ui/Button";
import { Field, FormError, Textarea } from "../../shared/components/ui/Field";

export function ConversationActions({
  id,
  status,
  canReply,
}: {
  id: string;
  status: string;
  canReply: boolean;
}) {
  const cache = useQueryClient();
  const [content, setContent] = useState("");
  const mutation = useMutation({
    mutationFn: (action: string) =>
      action === "reply"
        ? apiClient(`/conversations/${id}/messages`, {
            method: "POST",
            body: JSON.stringify({ content }),
          })
        : apiClient(`/admin/conversations/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ action }),
          }),
    onSuccess: () => {
      setContent("");
      void cache.invalidateQueries({ queryKey: ["conversation-inspector", id] });
      void cache.invalidateQueries({ queryKey: ["/admin/conversations"] });
    },
  });
  const closed = ["CLOSED", "RESOLVED"].includes(status);
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          busy={mutation.isPending}
          disabled={closed}
          onClick={() => mutation.mutate("claim")}
        >
          <UserCheck className="size-4" />
          Claim
        </Button>
        <Button
          variant="secondary"
          disabled={mutation.isPending || !canReply}
          onClick={() => mutation.mutate(closed ? "reopen" : "resolve")}
        >
          {closed ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
          {closed ? "Reopen" : "Resolve"}
        </Button>
        <Button
          variant="ghost"
          disabled={mutation.isPending || !canReply || closed}
          onClick={() => mutation.mutate("release")}
        >
          Release
        </Button>
      </div>
      {!closed && canReply && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate("reply");
          }}
        >
          <Field label="Reply to customer">
            <Textarea
              required
              maxLength={4000}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </Field>
          <Button type="submit" busy={mutation.isPending} disabled={!content.trim()}>
            Send reply
          </Button>
        </form>
      )}
      <FormError error={mutation.error} />
    </div>
  );
}
