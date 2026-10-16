#!/usr/bin/env node
// Live end-to-end check of a running API: agents, returns, refunds, handoff, knowledge, evaluations.
// Usage: pnpm smoke   (API_URL defaults to http://localhost:4000/api/v1; requires seeded demo data)
import { randomUUID } from "node:crypto";

const base = process.env.API_URL ?? "http://localhost:4000/api/v1";
const password = process.env.DEMO_PASSWORD ?? "demo-password";
let failures = 0;

async function call(method, path, token, body, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return {
    status: response.status,
    ok: response.ok && payload.success !== false,
    data: payload.data,
    error: payload.error,
  };
}

async function step(name, run) {
  try {
    const detail = await run();
    console.log(`PASS  ${name}${detail ? `  -> ${detail}` : ""}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${name}  -> ${error.message}`);
  }
}
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const need = (result, label = "request") => {
  expect(result.ok, `${label} failed (${result.status} ${result.error?.message ?? ""})`);
  return result.data;
};
const login = async (email) =>
  need(await call("POST", "/auth/login", null, { email, password }), `login ${email}`);
const tool = (name, token, body) =>
  call("POST", `/tools/${name}`, token, body, { "Idempotency-Key": randomUUID() });

const customer = await login("customer01@novastore.demo");
const support = await login("support@novastore.demo");
const admin = await login("admin@novastore.demo");
const C = customer.accessToken;
const S = support.accessToken;
const A = admin.accessToken;
const shared = {};

await step("health is ready", async () => need(await call("GET", "/health/ready")).status);

await step("customer lists orders", async () => {
  const orders = need(await call("GET", "/orders", C));
  expect(orders.length > 0, "no seeded orders");
  shared.delivered = orders.filter((o) => o.status === "DELIVERED" && o.deliveredAt);
  shared.cancellable = orders.find((o) => ["PENDING", "PAYMENT_CONFIRMED"].includes(o.status));
  return `${orders.length} orders`;
});

const prompts = [
  ["order lookup", "Where is my latest order?", "OrderAgent"],
  ["policy RAG", "What is the return policy for damaged items?", "KnowledgeAgent"],
  ["return intent", "I want to return my headphones", "ResolutionAgent"],
  ["refund intent", "I need a refund", "ResolutionAgent"],
  ["cancel intent", "Please cancel my order", "ResolutionAgent"],
  ["general", "Hello there", "Supervisor"],
];
for (const [label, message, route] of prompts) {
  await step(`agent: ${label}`, async () => {
    const conversation = need(await call("POST", "/conversations", C, { title: label }));
    const run = need(
      await call("POST", "/agent/chat", C, { conversationId: conversation._id, message }),
      "agent chat",
    );
    expect(run.agent === route, `routed to ${run.agent}, expected ${route}`);
    expect(run.response && run.response.length > 0, "empty response");
    if (route === "KnowledgeAgent")
      expect(run.sources.length > 0, "policy answer has no citations");
    return `${run.agent}: ${run.response.slice(0, 70).replace(/\s+/g, " ")}`;
  });
}

await step("agent: human escalation, then staff claim/reply/resolve/reopen", async () => {
  const conversation = need(await call("POST", "/conversations", C, { title: "handoff" }));
  const id = conversation._id;
  const run = need(
    await call("POST", "/agent/chat", C, {
      conversationId: id,
      message: "I want to talk to a human",
    }),
  );
  expect(run.agent === "HumanEscalation", `routed to ${run.agent}`);
  const paused = await call("POST", "/agent/chat", C, { conversationId: id, message: "hello?" });
  expect(paused.status === 409, "agent should pause while staff handles it");
  for (const action of ["claim", "release", "claim"])
    need(await call("PATCH", `/admin/conversations/${id}`, S, { action }), `staff ${action}`);
  need(
    await call("POST", `/conversations/${id}/messages`, S, {
      content: "Hi, I can help with that.",
    }),
    "staff reply",
  );
  need(await call("PATCH", `/admin/conversations/${id}`, S, { action: "resolve" }), "resolve");
  need(await call("PATCH", `/admin/conversations/${id}`, S, { action: "reopen" }), "reopen");
  const messages = need(await call("GET", `/conversations/${id}/messages`, C), "customer reads");
  expect(
    messages.some((m) => m.content.includes("I can help")),
    "customer cannot see staff reply",
  );
  return `${messages.length} messages`;
});

await step("cancellation requires confirmation", async () => {
  if (!shared.cancellable) return "skipped (no cancellable seed order)";
  const rejected = await tool("cancelOrder", C, { orderId: shared.cancellable._id });
  expect(rejected.status === 400, "cancellation without confirmation must be rejected");
  const done = need(
    await tool("cancelOrder", C, { orderId: shared.cancellable._id, confirmed: true }),
    "cancel",
  );
  expect(done.result.status === "CANCELLED", "order not cancelled");
  return done.result.orderNumber;
});

await step("return lifecycle: request, approve, receive, complete", async () => {
  expect(shared.delivered.length, "no delivered seed order");
  let created;
  for (const order of shared.delivered) {
    const attempt = await tool("createReturnRequest", C, {
      orderId: order._id,
      productId: String(order.items[0].product),
      quantity: 1,
      reason: "Smoke test return",
      confirmed: true,
    });
    if (attempt.status === 409) continue;
    created = need(attempt, "create return").result;
    break;
  }
  if (!created) return "skipped (every delivered seed order already has a return; reseed to rerun)";
  const forbidden = await call("PATCH", `/admin/returns/${created._id}`, C, {
    action: "approve",
    notes: "nope",
  });
  expect(forbidden.status === 403, "customer must not review returns");
  for (const action of ["approve", "receive", "complete"])
    need(
      await call("PATCH", `/admin/returns/${created._id}`, S, { action, notes: `Smoke ${action}` }),
      action,
    );
  const returns = need(await call("GET", "/customer/returns", C));
  expect(
    returns.find((r) => r._id === created._id)?.status === "COMPLETED",
    "customer does not see completed return",
  );
  return created.returnNumber;
});

await step("refund request needs staff approval", async () => {
  let refund;
  for (const order of shared.delivered) {
    const attempt = await tool("createRefundRequest", C, {
      orderId: order._id,
      productId: String(order.items[0].product),
      quantity: 1,
      reason: "Smoke test refund",
      confirmed: true,
    });
    if (attempt.status === 409) continue;
    refund = need(attempt, "create refund").result;
    break;
  }
  if (!refund) return "skipped (every delivered seed order already has a refund; reseed to rerun)";
  expect(refund.requiresApproval, "refund should require approval");
  const approvals = need(await call("GET", "/admin/approvals", S));
  const pending = approvals.find((a) => a._id === refund.approvalRequest._id);
  expect(pending, "approval not listed for staff");
  need(
    await call("PATCH", `/admin/approvals/${pending._id}`, S, {
      decision: "APPROVED",
      notes: "Smoke approval",
    }),
    "approve",
  );
  return "approved without claiming payment";
});

await step("support ticket", async () => {
  const ticket = need(
    await tool("createSupportTicket", C, {
      subject: "Smoke ticket",
      description: "Created by smoke test",
      category: "GENERAL",
    }),
  );
  return ticket.result.ticketNumber ?? "created";
});

await step("access control", async () => {
  expect((await call("GET", "/admin/approvals", C)).status === 403, "customer reached admin");
  expect((await call("GET", "/orders")).status === 401, "orders open to anonymous");
});

await step("knowledge search and document list", async () => {
  const hits = need(await call("GET", "/knowledge/search?q=shipping", A));
  const docs = need(await call("GET", "/knowledge", A));
  return `${hits.length ?? "?"} hits, ${docs.length ?? "?"} documents`;
});

await step("offline evaluation run", async () => {
  const run = need(await call("POST", "/evaluations/run", A), "run evaluation");
  expect(run.status === "COMPLETED", `status ${run.status}`);
  expect(run.metrics.passRate === 1, `passRate ${run.metrics.passRate}`);
  return `${run.metrics.cases} cases, passRate ${run.metrics.passRate}`;
});

await step("admin metrics and traces", async () => {
  need(await call("GET", "/admin/metrics", A));
  const traces = need(await call("GET", "/admin/traces", A));
  return `${traces.length} traces`;
});

await step("refresh rotation and logout", async () => {
  const next = need(
    await call("POST", "/auth/refresh", null, { refreshToken: customer.refreshToken }),
  );
  const reused = await call("POST", "/auth/refresh", null, { refreshToken: customer.refreshToken });
  expect(reused.status === 401, "reused token accepted");
  need(await call("POST", "/auth/logout", next.accessToken, { refreshToken: next.refreshToken }));
  const after = await call("POST", "/auth/refresh", null, { refreshToken: next.refreshToken });
  expect(after.status === 401, "token valid after logout");
});

console.log(failures ? `\n${failures} step(s) failed` : "\nAll workflows passed");
process.exit(failures ? 1 : 0);
