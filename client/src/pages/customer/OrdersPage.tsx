import { EmptyState } from "../../shared/components/feedback/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../shared/api/apiClient";
import { Link } from "react-router-dom";

type Order = {
  _id: string;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  items: { name: string; quantity: number }[];
  createdAt: string;
};

export const OrdersPage = (): React.ReactElement => {
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => apiClient<Order[]>("/orders") });
  if (orders.isLoading) return <p className="text-sm text-muted">Loading orders...</p>;
  if (orders.isError || !orders.data?.length)
    return (
      <EmptyState
        title={orders.isError ? "Orders could not be loaded" : "No orders yet"}
        description={
          orders.isError ? "Please try again shortly." : "Your NovaStore orders will appear here."
        }
      />
    );
  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-accent">Commerce</p>
        <h1 className="mt-1 text-2xl font-semibold">Your orders</h1>
        <p className="mt-2 text-sm text-muted">Track deliveries and review recent purchases.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div className="divide-y divide-border">
          {orders.data.map((order) => (
            <Link
              className="flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-mutedSurface sm:px-6"
              key={order._id}
              to={`/orders/${order._id}`}
            >
              <div>
                <p className="font-medium">{order.orderNumber}</p>
                <p className="mt-1 text-sm text-muted">
                  {order.items[0]?.name}{" "}
                  {order.items.length > 1 ? `+ ${order.items.length - 1} more` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  {order.currency} {order.total.toFixed(2)}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted">
                  {order.status.replaceAll("_", " ")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
