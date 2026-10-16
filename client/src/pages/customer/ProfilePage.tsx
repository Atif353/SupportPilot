import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../shared/api/apiClient";
import { PageHeader } from "../../shared/components/layout/PageHeader";

type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  customerNumber: string;
  lifetimeValue: number;
  orderCount: number;
};
export const ProfilePage = (): React.ReactElement => {
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: () => apiClient<Profile>("/customer/profile"),
  });
  if (query.isLoading) return <p className="text-sm text-muted">Loading profile...</p>;
  if (!query.data) return <p className="text-sm text-muted">Profile unavailable.</p>;
  const profile = query.data;
  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="Customer workspace"
        title="Profile"
        description="Your authenticated NovaStore customer identity and account summary."
      />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">Contact details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Name</dt>
              <dd>
                {profile.firstName} {profile.lastName}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Email</dt>
              <dd>{profile.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Phone</dt>
              <dd>{profile.phone ?? "Not provided"}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">Account summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Customer number</dt>
              <dd>{profile.customerNumber}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Orders</dt>
              <dd>{profile.orderCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Lifetime value</dt>
              <dd>USD {profile.lifetimeValue.toFixed(2)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
};
