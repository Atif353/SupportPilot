import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Send } from "lucide-react";
import { apiClient } from "../../shared/api/apiClient";
import { Button } from "../../shared/components/ui/Button";
import { Field, FormError, Select, Textarea } from "../../shared/components/ui/Field";
import { Input } from "../../shared/components/ui/Input";

export type ActionOrder = {
  _id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  currency: string;
  items: { product: string; name: string; quantity: number }[];
  shippingAddress: { line1: string; city: string; state: string; postalCode: string };
};
const labels: Record<string, string> = {
  createReturnRequest: "Request a return",
  createRefundRequest: "Request a refund",
  cancelOrder: "Cancel order",
  updateShippingAddress: "Update delivery address",
};
export function OrderActions({ order }: { order: ActionOrder }) {
  const cache = useQueryClient();
  const options = [
    order.status === "DELIVERED" && "createReturnRequest",
    order.paymentStatus === "PAID" && "createRefundRequest",
    ["PENDING", "PAYMENT_CONFIRMED"].includes(order.status) && "cancelOrder",
    ["PENDING", "PAYMENT_CONFIRMED"].includes(order.status) && "updateShippingAddress",
  ].filter(Boolean) as string[];
  const [action, setAction] = useState(options[0] ?? "");
  const [reason, setReason] = useState("");
  const [productId, setProductId] = useState(order.items[0]?.product ?? "");
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState(order.shippingAddress);
  const [reviewing, setReviewing] = useState(false);
  const key = useRef({ payload: "", value: crypto.randomUUID() });
  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        orderId: order._id,
        confirmed: true,
        ...(action === "createReturnRequest"
          ? { reason, productId, quantity }
          : action === "createRefundRequest"
            ? { reason }
            : action === "updateShippingAddress"
              ? address
              : {}),
      };
      const fingerprint = JSON.stringify({ action, body });
      if (key.current.payload !== fingerprint)
        key.current = { payload: fingerprint, value: crypto.randomUUID() };
      return apiClient(`/tools/${action}`, {
        method: "POST",
        headers: { "Idempotency-Key": key.current.value },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["order", order._id] });
      await cache.invalidateQueries({ queryKey: ["orders"] });
    },
  });
  if (mutation.isSuccess)
    return (
      <div role="status" className="flex items-start gap-3 border-t border-border py-6 text-sm">
        <Check className="size-5 text-emerald-700" />
        <p>
          {action === "createRefundRequest"
            ? "Refund request submitted for staff review. No payment has been issued."
            : "Your request has been recorded."}
        </p>
      </div>
    );
  if (!options.length) return null;
  return (
    <section className="border-t border-border py-6">
      <h2 className="mb-4 font-semibold">Order requests</h2>
      <form
        className="grid max-w-2xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setReviewing(true);
        }}
      >
        <fieldset disabled={reviewing || mutation.isPending} className="grid gap-4">
          <Field label="Request">
            <Select
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                mutation.reset();
              }}
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {labels[option]}
                </option>
              ))}
            </Select>
          </Field>
          {action === "createReturnRequest" && (
            <div className="grid gap-4 sm:grid-cols-[1fr_100px]">
              <Field label="Item">
                <Select
                  value={productId}
                  onChange={(event) => {
                    setProductId(event.target.value);
                    setQuantity(1);
                  }}
                >
                  {order.items.map((item) => (
                    <option key={item.product} value={item.product}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Quantity">
                <Input
                  type="number"
                  min={1}
                  max={order.items.find((item) => item.product === productId)?.quantity ?? 1}
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                />
              </Field>
            </div>
          )}
          {["createReturnRequest", "createRefundRequest"].includes(action) && (
            <Field label="Reason">
              <Textarea
                value={reason}
                required
                minLength={3}
                maxLength={2000}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          )}
          {action === "updateShippingAddress" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["line1", "city", "state", "postalCode"] as const).map((field) => (
                <Field
                  key={field}
                  label={
                    {
                      line1: "Street address",
                      city: "City",
                      state: "State / province",
                      postalCode: "Postal code",
                    }[field]
                  }
                >
                  <Input
                    required
                    minLength={field === "city" || field === "state" ? 2 : 3}
                    value={address[field]}
                    onChange={(event) => setAddress({ ...address, [field]: event.target.value })}
                  />
                </Field>
              ))}
            </div>
          )}
        </fieldset>
        {reviewing && (
          <div className="border-l-2 border-amber-500 pl-4 text-sm">
            <p className="font-semibold">
              {labels[action]}: {order.orderNumber}
            </p>
            <p className="mt-1 text-muted">
              {action === "createRefundRequest"
                ? `${order.currency} ${order.total.toFixed(2)} will be submitted for review, not paid automatically.`
                : action === "cancelOrder"
                  ? "Cancellation cannot be undone. Any refund requires separate review."
                  : "Please check your selection before confirming."}
            </p>
          </div>
        )}
        <FormError error={mutation.error} />
        <div className="flex flex-wrap gap-2">
          {reviewing ? (
            <>
              <Button busy={mutation.isPending} onClick={() => mutation.mutate()}>
                <Check className="size-4" />
                Confirm request
              </Button>
              <Button
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() => setReviewing(false)}
              >
                <Pencil className="size-4" />
                Edit
              </Button>
            </>
          ) : (
            <Button type="submit">
              <Send className="size-4" />
              Review request
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
