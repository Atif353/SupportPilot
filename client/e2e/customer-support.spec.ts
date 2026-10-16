import { expect, test } from "@playwright/test";

test("customer can sign in, ask support, and browse orders", async ({ page }) => {
  const messages: { _id: string; senderType: string; content: string; createdAt: string }[] = [];
  await page.route("**/api/v1/auth/login", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          accessToken: "e2e-access-token",
          refreshToken: "e2e-refresh-token",
          user: {
            id: "user-1",
            email: "customer01@novastore.demo",
            role: "CUSTOMER",
            firstName: "Jordan",
            lastName: "Customer1",
          },
          customerId: "customer-1",
        },
      }),
    }),
  );
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { _id: "conversation-1", title: "Support request", status: "OPEN" },
        }),
      });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
  await page.route("**/api/v1/conversations/*/messages", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: messages }),
    }),
  );
  await page.route("**/api/v1/agent/chat", async (route) => {
    messages.push({
      _id: "message-1",
      senderType: "AI",
      content: "Your order is in transit.",
      createdAt: new Date().toISOString(),
    });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          response: "Your order is in transit.",
          agent: "OrderAgent",
          sources: [],
          traceId: "trace-1",
        },
      }),
    });
  });
  await page.route("**/api/v1/orders", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          {
            _id: "order-1",
            orderNumber: "ORD-000001",
            status: "SHIPPED",
            total: 149.99,
            currency: "USD",
            items: [{ name: "Wireless Headphones", quantity: 1 }],
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    }),
  );

  await page.goto("/login");
  await page.getByLabel("Email").fill("customer01@novastore.demo");
  await page.getByLabel("Password").fill("demo-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/support$/);
  await page
    .getByPlaceholder("Ask about an order, return, refund, or policy")
    .fill("Where is my latest order?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Your order is in transit.")).toBeVisible();
  await page.screenshot({ path: "test-results/support-chat.png", fullPage: true });
  await page.goto("/orders");
  await expect(page.getByText("ORD-000001")).toBeVisible();
});
