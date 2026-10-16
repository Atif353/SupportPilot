import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, role = "CUSTOMER") {
  await page.addInitScript(
    (role) =>
      localStorage.setItem(
        "supportpilot.session",
        JSON.stringify({
          accessToken: "test-access",
          refreshToken: "test-refresh",
          user: {
            id: "user-1",
            email: "test@example.test",
            role,
            firstName: "Jordan",
            lastName: "Lee",
          },
        }),
      ),
    role,
  );
}
const respond = (data: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ success: true, data }),
});

test("staff completes the return review and inspection workflow", async ({ page }) => {
  await signIn(page, "SUPPORT");
  const record = {
    _id: "return-1",
    returnNumber: "RET-1001",
    status: "REQUESTED",
    reason: "Damaged on arrival",
    items: [{ product: "product-1", quantity: 1 }],
    customer: { firstName: "Jordan", lastName: "Lee", email: "jordan@example.test" },
    order: { orderNumber: "ORD-1001", items: [{ product: "product-1", name: "Headphones" }] },
    history: [] as { status: string; notes: string; changedAt: string }[],
  };
  await page.route("**/api/v1/admin/returns?*", (route) => route.fulfill(respond([record])));
  await page.route("**/api/v1/admin/returns", (route) => route.fulfill(respond([record])));
  await page.route("**/api/v1/admin/returns/return-1", (route) => {
    const body = route.request().postDataJSON();
    record.status = (
      { approve: "APPROVED", receive: "RECEIVED", complete: "COMPLETED" } as Record<string, string>
    )[body.action];
    record.history.push({
      status: record.status,
      notes: body.notes,
      changedAt: new Date().toISOString(),
    });
    return route.fulfill(respond(record));
  });
  await page.goto("/admin/returns");
  await page.getByLabel("Return status").selectOption("");
  await expect(page.getByRole("button", { name: "Approve return" })).toBeDisabled();
  await page
    .getByLabel("Customer-visible notes")
    .fill("Photos confirm damage. Please return the item.");
  await page.getByRole("button", { name: "Approve return" }).click();
  await expect(page.getByRole("button", { name: "Mark received" })).toBeVisible();
  await page.getByLabel("Customer-visible notes").fill("Parcel received at warehouse.");
  await page.getByRole("button", { name: "Mark received" }).click();
  await expect(page.getByRole("button", { name: "Complete inspection" })).toBeVisible();
  await page.getByLabel("Customer-visible notes").fill("Inspection confirms damage.");
  await page.getByRole("button", { name: "Complete inspection" }).click();
  await expect(page.getByRole("article").getByText("COMPLETED", { exact: true })).toBeVisible();
  await page.getByText("Request history", { exact: true }).click();
  await expect(page.getByText("Inspection confirms damage.")).toBeVisible();
  await page.screenshot({ path: "test-results/return-workflow.png", fullPage: true });
});

test("mobile customer switches conversations and creates a clean conversation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const conversations = [
    { _id: "first", title: "Delivery", status: "OPEN" },
    { _id: "second", title: "Returns", status: "OPEN" },
  ];
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() === "POST") {
      const created = { _id: "third", title: "Support request", status: "OPEN" };
      conversations.unshift(created);
      return route.fulfill(respond(created));
    }
    return route.fulfill(respond(conversations));
  });
  await page.route("**/api/v1/conversations/*/messages", async (route) => {
    const id = route.request().url().split("/").at(-2);
    return route.fulfill(
      respond(
        id === "third"
          ? []
          : [
              {
                _id: `message-${id}`,
                senderType: "AI",
                content:
                  id === "first" ? "Your parcel is on its way." : "Your return was received.",
                createdAt: "2026-09-21T10:00:00Z",
              },
            ],
      ),
    );
  });
  await page.goto("/support");
  await expect(page.getByText("Your parcel is on its way.")).toBeVisible();
  await page.getByLabel("Active conversation").selectOption("second");
  await expect(page.getByText("Your return was received.")).toBeVisible();
  await expect(page.getByText("Your parcel is on its way.")).toHaveCount(0);
  await page.getByRole("button", { name: "New conversation" }).click();
  await expect(page.getByText("How can we help?")).toBeVisible();
  await expect(page.getByText("Your return was received.")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/support-mobile.png", fullPage: true });
});

test("customer reviews a selected item before submitting a return with auth and idempotency headers", async ({
  page,
}) => {
  await signIn(page);
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/v1/orders/order-1", (route) =>
    route.fulfill(
      respond({
        _id: "order-1",
        orderNumber: "ORD-1001",
        status: "DELIVERED",
        paymentStatus: "PAID",
        total: 99,
        currency: "USD",
        items: [{ product: "product-1", name: "Headphones", quantity: 2, lineTotal: 99 }],
        shippingAddress: {
          line1: "42 Main Street",
          city: "Austin",
          state: "TX",
          postalCode: "78701",
        },
        shipmentHistory: [],
      }),
    ),
  );
  await page.route("**/api/v1/tools/createReturnRequest", async (route) => {
    submitted = route.request().postDataJSON();
    expect(route.request().headers().authorization).toBe("Bearer test-access");
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    return route.fulfill(respond({ result: { status: "REQUESTED" } }));
  });
  await page.goto("/orders/order-1");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Reason").fill("The left speaker does not work.");
  await page.getByRole("button", { name: "Review request" }).click();
  expect(submitted).toBeUndefined();
  await page.screenshot({ path: "test-results/order-confirmation.png", fullPage: true });
  await page.getByRole("button", { name: "Confirm request" }).click();
  await expect(page.getByText("Your request has been recorded.")).toBeVisible();
  expect(submitted).toMatchObject({
    confirmed: true,
    orderId: "order-1",
    productId: "product-1",
    quantity: 2,
  });
});

test("support agent claims, replies, and resolves a conversation", async ({ page }) => {
  await signIn(page, "SUPPORT");
  const conversation = {
    title: "Damaged headphones",
    status: "WAITING",
    channel: "WEB",
    assignedTo: null as null | { _id: string },
    customer: { email: "jordan@example.test" },
  };
  const messages: { content: string; senderType: string; createdAt: string }[] = [
    {
      content: "My headphones arrived damaged.",
      senderType: "CUSTOMER",
      createdAt: "2026-09-21T10:00:00Z",
    },
  ];
  await page.route("**/api/v1/admin/conversations/conversation-1", (route) => {
    if (route.request().method() === "PATCH") {
      const { action } = route.request().postDataJSON();
      if (action === "claim") {
        conversation.assignedTo = { _id: "user-1" };
        conversation.status = "OPEN";
      }
      if (action === "resolve") conversation.status = "RESOLVED";
      return route.fulfill(respond(conversation));
    }
    return route.fulfill(respond({ conversation, messages, traces: [] }));
  });
  await page.route("**/api/v1/conversations/conversation-1/messages", (route) => {
    messages.push({
      content: route.request().postDataJSON().content,
      senderType: "AGENT",
      createdAt: new Date().toISOString(),
    });
    return route.fulfill(respond({ message: messages.at(-1) }));
  });
  await page.goto("/admin/conversations/conversation-1");
  await page.getByRole("button", { name: "Claim", exact: true }).click();
  await page
    .getByLabel("Reply to customer")
    .fill("I have reviewed your photos and can help with a return.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(
    page.getByText("I have reviewed your photos and can help with a return."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
  await page.screenshot({ path: "test-results/staff-conversation.png", fullPage: true });
});

test("staff must enter a reason before approving a refund", async ({ page }) => {
  await signIn(page, "SUPPORT");
  const approval = {
    _id: "approval-1",
    requestType: "REFUND",
    status: "PENDING",
    createdAt: "2026-09-21T10:00:00Z",
    payload: { amount: "99", currency: "USD", reason: "Damaged headphones" },
    order: { orderNumber: "ORD-1001" },
    requestedBy: { email: "jordan@example.test" },
  };
  await page.route("**/api/v1/admin/approvals", (route) => route.fulfill(respond([approval])));
  await page.route("**/api/v1/admin/approvals/approval-1", (route) => {
    expect(route.request().postDataJSON().notes).toBe("Photos confirm damage");
    approval.status = "APPROVED";
    return route.fulfill(respond(approval));
  });
  await page.goto("/admin/approvals");
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeDisabled();
  await page.getByLabel("Decision reason").fill("Photos confirm damage");
  await page.screenshot({ path: "test-results/approval-review.png", fullPage: true });
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
});

test("administrator queues a document and previews search results on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "ADMIN");
  const documents: {
    _id: string;
    title: string;
    sourceType: string;
    status: string;
    version: number;
    indexStatus: string;
    chunkCount: number;
  }[] = [];
  await page.route("**/api/v1/knowledge", (route) => route.fulfill(respond(documents)));
  await page.route("**/api/v1/knowledge/documents", (route) => {
    documents.push({
      _id: "doc-1",
      title: route.request().postDataJSON().title,
      sourceType: "POLICY",
      status: "DRAFT",
      version: 1,
      indexStatus: "QUEUED",
      chunkCount: 0,
    });
    return route.fulfill(respond(documents[0]));
  });
  await page.route("**/api/v1/knowledge/search?*", (route) =>
    route.fulfill(
      respond([
        {
          title: "Returns policy",
          content: "Returns are accepted within 30 days of delivery.",
          source: "knowledge://doc-1",
          score: 0.007,
        },
      ]),
    ),
  );
  await page.goto("/admin/knowledge");
  await page.getByText("Add documents", { exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Returns policy");
  await page
    .getByLabel("Document content")
    .fill("Returns are accepted within 30 days of delivery.");
  await page.getByRole("button", { name: "Queue document" }).click();
  await expect(page.getByText("QUEUED", { exact: true })).toBeVisible();
  await page.getByLabel("Search knowledge").fill("returns");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("Returns are accepted within 30 days of delivery.", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/knowledge-mobile.png", fullPage: true });
});

test("administrator runs evaluations and inspects individual results", async ({ page }) => {
  await signIn(page, "ADMIN");
  const run = {
    _id: "run-1",
    name: "Offline agent regression",
    status: "COMPLETED",
    dataset: "supportpilot-fixtures-v2",
    mode: "FIXTURE",
    metrics: { cases: 1, passRate: 1 },
    results: [
      {
        id: "case-1",
        prompt: "Where is my order?",
        expectedRoute: "OrderAgent",
        actualRoute: "OrderAgent",
        passed: true,
        toolCalls: ["getCustomerOrders"],
        latencyMs: 12,
      },
    ],
  };
  let completed = false;
  await page.route("**/api/v1/evaluations", (route) =>
    route.fulfill(respond(completed ? [run] : [])),
  );
  await page.route("**/api/v1/evaluations/run", (route) => {
    completed = true;
    return route.fulfill(respond(run));
  });
  await page.goto("/admin/evaluations");
  await page.getByRole("button", { name: "Run fixtures" }).click();
  await page.getByText("Case results (1)").click();
  await expect(page.getByText("Where is my order?")).toBeVisible();
  await page.screenshot({ path: "test-results/evaluation-results.png", fullPage: true });
});
