import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../../shared/api/apiClient";
import { EmptyState } from "../../shared/components/feedback/EmptyState";
import { OrderActions } from "../../features/orders/OrderActions";

type Tracking = {
  orderNumber: string;
  status: string;
  trackingNumber?: string;
  carrier?: string;
  estimatedDeliveryAt?: string;
  shipmentHistory: { status: string; location: string; description: string; occurredAt: string }[];
};
type Order = Tracking & {
  _id: string;
  total: number;
  currency: string;
  paymentStatus: string;
  items: { product: string; name: string; quantity: number; lineTotal: number }[];
  shippingAddress: { line1: string; city: string; state: string; postalCode: string };
};

export const OrderDetailPage = (): React.ReactElement => {
  const { orderId } = useParams();
  const order = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => apiClient<Order>(`/orders/${orderId}`),
    enabled: Boolean(orderId),
  });
  if (order.isLoading) return <p className="text-sm text-muted">Loading order...</p>;
  if (order.isError || !order.data)
    return <EmptyState title="Order unavailable" description="We could not load this order." />;
  const data = order.data;
  return (
    <section className="space-y-6">
      <Link className="text-sm font-medium text-accent" to="/orders">
        Back to orders
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-accent">Order detail</p>
          <h1 className="mt-1 text-2xl font-semibold">{data.orderNumber}</h1>
        </div>
        <p className="text-xl font-semibold">
          {data.currency} {data.total.toFixed(2)}
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">Shipment timeline</h2>
          <div className="mt-5 space-y-5">
            {data.shipmentHistory.map((event) => (
              <div className="flex gap-3" key={`${event.status}-${event.occurredAt}`}>
                <div className="mt-1 size-2 shrink-0 rounded-full bg-accent" />
                <div>
                  <p className="font-medium">{event.description}</p>
                  <p className="text-sm text-muted">
                    {event.location} · {new Date(event.occurredAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="font-semibold">Items</h2>
            {data.items.map((item) => (
              <div className="mt-4 flex justify-between text-sm" key={item.name}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{item.lineTotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="font-semibold">Delivery</h2>
            <p className="mt-3 text-sm text-muted">
              {data.shippingAddress.line1}, {data.shippingAddress.city},{" "}
              {data.shippingAddress.state} {data.shippingAddress.postalCode}
            </p>
            {data.trackingNumber && (
              <p className="mt-2 text-sm text-muted">
                {data.carrier}: {data.trackingNumber}
              </p>
            )}
          </div>
        </div>
      </div>
      <OrderActions key={data._id} order={data} />
    </section>
  );
};
