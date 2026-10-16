import { createBrowserRouter, Navigate } from "react-router-dom";
import { AdminLayout } from "../layouts/AdminLayout";
import { CustomerLayout } from "../layouts/CustomerLayout";
import { AdminDashboardPage } from "../../pages/admin/AdminDashboardPage";
import { LoginPage } from "../../pages/auth/LoginPage";
import { CustomerRecordsPage } from "../../pages/customer/CustomerRecordsPage";
import { ProfilePage } from "../../pages/customer/ProfilePage";
import { AdminDataPage } from "../../pages/admin/AdminDataPage";
import { OrdersPage } from "../../pages/customer/OrdersPage";
import { RouteError } from "../../shared/components/feedback/RouteError";

export const router = createBrowserRouter([
  {
    path: "/login",
    errorElement: <RouteError />,
    element: <LoginPage />,
  },
  {
    element: <CustomerLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/support" replace /> },
      {
        path: "/support",
        lazy: async () => ({
          Component: (await import("../../pages/customer/SupportPage")).SupportPage,
        }),
      },
      { path: "/orders", element: <OrdersPage /> },
      {
        path: "/refunds",
        element: (
          <CustomerRecordsPage
            title="Refunds"
            description="Refund requests and payment status"
            endpoint="/customer/refunds"
            empty="No refund requests yet."
          />
        ),
      },
      {
        path: "/orders/:orderId",
        lazy: async () => ({
          Component: (await import("../../pages/customer/OrderDetailPage")).OrderDetailPage,
        }),
      },
      {
        path: "/returns",
        element: (
          <CustomerRecordsPage
            title="Returns"
            description="Review your return requests and their current status."
            endpoint="/customer/returns"
            empty="No return requests yet."
          />
        ),
      },
      {
        path: "/tickets",
        element: (
          <CustomerRecordsPage
            title="Support tickets"
            description="Follow your requests and support history."
            endpoint="/customer/tickets"
            empty="No support tickets yet."
          />
        ),
      },
      {
        path: "/profile",
        element: <ProfilePage />,
      },
    ],
  },
  {
    path: "/admin",
    errorElement: <RouteError />,
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      {
        path: "returns",
        lazy: async () => ({
          Component: (await import("../../pages/admin/ReturnsPage")).ReturnsPage,
        }),
      },
      {
        path: "conversations",
        element: (
          <AdminDataPage
            title="Conversations"
            description="Inspect customer conversations and support activity."
            endpoint="/admin/conversations"
            label="conversations"
          />
        ),
      },
      {
        path: "conversations/:conversationId",
        lazy: async () => ({
          Component: (await import("../../pages/admin/ConversationInspectorPage"))
            .ConversationInspectorPage,
        }),
      },
      {
        path: "approvals",
        lazy: async () => ({
          Component: (await import("../../pages/admin/ApprovalsPage")).ApprovalsPage,
        }),
      },
      {
        path: "customers",
        element: (
          <AdminDataPage
            title="Customers"
            description="Review customer profiles and support context."
            endpoint="/admin/customers"
            label="customers"
          />
        ),
      },
      {
        path: "orders",
        element: (
          <AdminDataPage
            title="Orders"
            description="Review the commerce order stream."
            endpoint="/admin/orders"
            label="orders"
          />
        ),
      },
      {
        path: "tickets",
        element: (
          <AdminDataPage
            title="Tickets"
            description="Manage customer support tickets and proactive cases."
            endpoint="/admin/tickets"
            label="tickets"
          />
        ),
      },
      {
        path: "knowledge",
        lazy: async () => ({
          Component: (await import("../../pages/admin/KnowledgePage")).KnowledgePage,
        }),
      },
      {
        path: "ai-runs",
        element: (
          <AdminDataPage
            title="AI runs"
            description="Inspect agent traces, tool calls, and latency."
            endpoint="/admin/traces"
            label="AI runs"
          />
        ),
      },
      {
        path: "evaluations",
        lazy: async () => ({
          Component: (await import("../../pages/admin/EvaluationsPage")).EvaluationsPage,
        }),
      },
      {
        path: "analytics",
        element: (
          <AdminDataPage
            title="Analytics"
            description="Review live operational metrics and activity records."
            endpoint="/admin/metrics"
            label="analytics"
          />
        ),
      },
    ],
  },
]);
