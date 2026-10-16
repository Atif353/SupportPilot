import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../shared/api/apiClient";
import { Button } from "../../shared/components/ui/Button";
import { Input } from "../../shared/components/ui/Input";
import { Field, FormError, Select, Textarea } from "../../shared/components/ui/Field";

export function CreateTicket() {
  const cache = useQueryClient();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const request = useRef({ payload: "", key: crypto.randomUUID() });
  const mutation = useMutation({
    mutationFn: () => {
      const payload = JSON.stringify({ subject, description, category });
      if (request.current.payload !== payload)
        request.current = { payload, key: crypto.randomUUID() };
      return apiClient("/tools/createSupportTicket", {
        method: "POST",
        headers: { "Idempotency-Key": request.current.key },
        body: payload,
      });
    },
    onSuccess: () => {
      setSubject("");
      setDescription("");
      void cache.invalidateQueries({ queryKey: ["/customer/tickets"] });
    },
  });
  return (
    <details className="border-y border-border py-4">
      <summary className="font-medium">Create a support ticket</summary>
      <form
        className="mt-4 grid max-w-2xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <Field label="Subject">
          <Input
            required
            minLength={3}
            maxLength={200}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            {["GENERAL", "DELIVERY", "RETURN", "REFUND"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </Field>
        <Field label="Description">
          <Textarea
            required
            minLength={3}
            maxLength={4000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <FormError error={mutation.error} />
        {mutation.isSuccess && (
          <p role="status" className="text-sm text-emerald-700">
            Ticket submitted.
          </p>
        )}
        <div>
          <Button type="submit" busy={mutation.isPending}>
            Submit ticket
          </Button>
        </div>
      </form>
    </details>
  );
}
