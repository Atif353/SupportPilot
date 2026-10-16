import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createServer } from "node:net";
import mongoose, { Types } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createAccessToken, hashPassword, signToken } from "../../src/modules/auth/auth.service.js";
import { env } from "../../src/config/env.js";
import { findMongoBinary } from "../../src/scripts/mongoBinary.js";
import { Customer } from "../../src/modules/models/customer.model.js";
import { User } from "../../src/modules/models/user.model.js";
import { Order } from "../../src/modules/models/order.model.js";
import { Conversation } from "../../src/modules/models/conversation.model.js";
import { Message } from "../../src/modules/models/message.model.js";
import { RefundRequest } from "../../src/modules/models/refund-request.model.js";
import { ReturnRequest } from "../../src/modules/models/return-request.model.js";
import { AgentTrace } from "../../src/modules/models/agent-trace.model.js";
import { ApprovalRequest } from "../../src/modules/models/approval-request.model.js";
import { KnowledgeDocument } from "../../src/modules/models/knowledge-document.model.js";
import { PolicyChunk } from "../../src/modules/models/policy-chunk.model.js";
import {
  ingestKnowledge,
  processNextDocument,
  queueDocument,
} from "../../src/modules/knowledge/knowledge.ingest.js";
import { lexicalSearch } from "../../src/modules/knowledge/retrieval/lexical.retriever.js";
import { retrievalCases, scoreRetrieval } from "../../src/modules/evaluations/retrieval.cases.js";
import { recoverInterruptedRuns } from "../../src/modules/agent/run.recovery.js";
import { authenticateSocket } from "../../src/modules/auth/session.service.js";

const app = createApp();
const userId = new Types.ObjectId().toString();
const otherId = new Types.ObjectId().toString();
const staffId = new Types.ObjectId().toString();
const token = createAccessToken({ sub: userId, role: "CUSTOMER" });
const otherToken = createAccessToken({ sub: otherId, role: "CUSTOMER" });
const staffToken = createAccessToken({ sub: staffId, role: "SUPPORT" });
const productId = new Types.ObjectId().toString();
let mongo: ChildProcess;
let directory = "";
let orderId = "";
let conversationId = "";
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
const postTool = (name: string, body: object, key = "test-key", auth = token) =>
  request(app)
    .post(`/api/v1/tools/${name}`)
    .auth(auth, { type: "bearer" })
    .set("Idempotency-Key", key)
    .send(body);

beforeAll(async () => {
  const listener = createServer();
  await new Promise<void>((done) => listener.listen(0, "127.0.0.1", done));
  const port = (listener.address() as { port: number }).port;
  await new Promise<void>((done) => listener.close(() => done()));
  directory = await mkdtemp(join(tmpdir(), "supportpilot-test-"));
  const binary = await findMongoBinary();
  mongo = spawn(
    binary,
    [
      "--dbpath",
      directory,
      "--port",
      String(port),
      "--bind_ip",
      "127.0.0.1",
      "--replSet",
      "testRs",
      "--logpath",
      join(directory, "mongo.log"),
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let spawnError: Error | undefined;
  mongo.on("error", (error) => {
    spawnError = error;
  });
  const uri = `mongodb://127.0.0.1:${port}/supportpilot-isolated-test?directConnection=true`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (spawnError) throw spawnError;
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 500,
        autoCreate: false,
        autoIndex: false,
      });
      break;
    } catch {
      await pause(200);
    }
  }
  if (!mongoose.connection.db)
    throw new Error("Isolated MongoDB failed to start. Set MONGOD_BINARY.");
  await mongoose.connection.db.admin().command({
    replSetInitiate: { _id: "testRs", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (hello.isWritablePrimary) break;
    await pause(250);
  }
  for (const model of Object.values(mongoose.models)) {
    await model.createCollection();
    await model.createIndexes();
  }
}, 60000);

beforeEach(async () => {
  for (const model of Object.values(mongoose.models)) await model.deleteMany({});
  await User.create([
    {
      _id: userId,
      email: "customer@example.test",
      role: "CUSTOMER",
      firstName: "Test",
      lastName: "Customer",
      passwordHash: "fixture-hash",
    },
    {
      _id: otherId,
      email: "other@example.test",
      role: "CUSTOMER",
      firstName: "Other",
      lastName: "Customer",
      passwordHash: "fixture-hash",
    },
    {
      _id: staffId,
      email: "staff@example.test",
      role: "SUPPORT",
      firstName: "Support",
      lastName: "Agent",
      passwordHash: "fixture-hash",
    },
  ]);
  const customer = await Customer.create({
    user: userId,
    customerNumber: "TEST-CUSTOMER",
    email: "customer@example.test",
    firstName: "Test",
    lastName: "Customer",
  });
  const order = await Order.create({
    orderNumber: "TEST-ORDER",
    customer: customer._id,
    items: [
      {
        product: productId,
        sku: "SKU",
        name: "Headphones",
        quantity: 2,
        unitPrice: 50,
        lineTotal: 100,
      },
    ],
    subtotal: 100,
    shippingCost: 0,
    tax: 0,
    total: 100,
    status: "DELIVERED",
    paymentStatus: "PAID",
    deliveredAt: new Date(),
    shippingAddress: {
      label: "Home",
      line1: "123 Test St",
      city: "Test",
      state: "TS",
      postalCode: "12345",
      country: "US",
    },
  });
  orderId = order.id;
  const conversation = await Conversation.create({
    customer: customer._id,
    title: "Test conversation",
  });
  conversationId = conversation.id;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo && mongo.exitCode === null) {
    const stopped = new Promise<void>((done) => mongo.once("exit", () => done()));
    mongo.kill();
    await stopped;
  }
  const target = resolve(directory);
  if (
    directory &&
    target.startsWith(resolve(tmpdir()) + sep) &&
    target.includes("supportpilot-test-")
  )
    await rm(target, { recursive: true, force: true });
}, 15000);

describe("authorization and confirmed actions", () => {
  it("rejects sessions belonging to deactivated users", async () => {
    await User.updateOne({ _id: userId }, { isActive: false });
    expect((await postTool("getCustomerOrders", {})).status).toBe(401);
    expect(await authenticateSocket(token)).toBeNull();
  });
  it("blocks cancellation after processing starts", async () => {
    await Order.updateOne({ _id: orderId }, { status: "PROCESSING" });
    expect((await postTool("cancelOrder", { orderId, confirmed: true })).status).toBe(409);
    expect((await Order.findById(orderId))?.status).toBe("PROCESSING");
  });
  it("enforces the return lifecycle, ownership roles, and one transition under concurrency", async () => {
    const result = await postTool("createReturnRequest", {
      orderId,
      productId,
      quantity: 1,
      reason: "Damaged on arrival",
      confirmed: true,
    });
    expect(result.status).toBe(200);
    const id = result.body.data.result._id;
    const transition = (action: string, auth = staffToken) =>
      request(app)
        .patch(`/api/v1/admin/returns/${id}`)
        .auth(auth, { type: "bearer" })
        .send({ action, notes: `Verified ${action}` });
    expect((await transition("approve", token)).status).toBe(403);
    expect((await transition("complete")).status).toBe(409);
    const approvals = await Promise.all([transition("approve"), transition("approve")]);
    expect(approvals.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await transition("receive")).status).toBe(200);
    expect((await transition("complete")).status).toBe(200);
    expect((await transition("reject")).status).toBe(409);
    const record = await ReturnRequest.findById(id);
    expect(record?.history.map((event) => event.status)).toEqual([
      "APPROVED",
      "RECEIVED",
      "COMPLETED",
    ]);
    expect(record?.resolvedAt).toBeInstanceOf(Date);
    expect(await RefundRequest.countDocuments()).toBe(0);
    const customerView = await request(app)
      .get("/api/v1/customer/returns")
      .auth(token, { type: "bearer" });
    expect(customerView.body.data[0].resolutionNotes).toBe("Verified complete");
  });
  it("keeps released conversations waiting for humans and never claims a resolved conversation", async () => {
    const action = (action: string) =>
      request(app)
        .patch(`/api/v1/admin/conversations/${conversationId}`)
        .auth(staffToken, { type: "bearer" })
        .send({ action });
    expect((await action("claim")).status).toBe(200);
    expect((await action("release")).status).toBe(200);
    expect((await Conversation.findById(conversationId))?.status).toBe("WAITING");
    expect((await action("claim")).status).toBe(200);
    expect((await action("resolve")).status).toBe(200);
    expect((await action("claim")).status).toBe(409);
    expect((await action("reopen")).status).toBe(200);
    await Conversation.updateOne(
      { _id: conversationId },
      { agentLeaseUntil: new Date(Date.now() + 60000) },
    );
    expect((await action("claim")).status).toBe(409);
  });
  it("fails closed when a customer profile is missing", async () => {
    expect((await postTool("getCustomerOrders", {}, "key", otherToken)).status).toBe(404);
    expect((await postTool("getOrder", { orderId }, "key", otherToken)).status).toBe(404);
  });
  it("rejects cross-customer chat and escalation before messages or tools run", async () => {
    await Customer.create({
      user: otherId,
      customerNumber: "OTHER",
      email: "other@example.test",
      firstName: "Other",
      lastName: "Customer",
    });
    const chat = await request(app)
      .post("/api/v1/agent/chat")
      .auth(otherToken, { type: "bearer" })
      .send({ conversationId, message: "Cancel the order" });
    expect(chat.status).toBe(404);
    expect((await postTool("escalateToHuman", { conversationId }, "key", otherToken)).status).toBe(
      404,
    );
    expect(await Message.countDocuments()).toBe(0);
  });
  it("requires confirmation and keeps paid status on cancellation", async () => {
    await Order.updateOne({ _id: orderId }, { status: "PAYMENT_CONFIRMED" });
    expect((await postTool("cancelOrder", { orderId })).status).toBe(400);
    expect((await postTool("cancelOrder", { orderId, confirmed: true })).status).toBe(200);
    expect((await Order.findById(orderId))?.paymentStatus).toBe("PAID");
  });
  it("deduplicates simultaneous refunds and rejects key reuse with changed input", async () => {
    const body = { orderId, confirmed: true, reason: "Damaged item" };
    const responses = await Promise.all([
      postTool("createRefundRequest", body),
      postTool("createRefundRequest", body),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses[0]!.body.data.result.refundRequest._id).toBe(
      responses[1]!.body.data.result.refundRequest._id,
    );
    expect(await RefundRequest.countDocuments()).toBe(1);
    expect(await ApprovalRequest.countDocuments()).toBe(1);
    expect(
      (await postTool("createRefundRequest", { ...body, reason: "Different reason" })).status,
    ).toBe(409);
    expect((await postTool("createRefundRequest", body, "test-key", otherToken)).status).toBe(404);
  });
  it("serializes different keys for one refund and approves without claiming payment", async () => {
    const body = { orderId, confirmed: true, reason: "Damaged item", conversationId };
    const responses = await Promise.all([
      postTool("createRefundRequest", body, "one"),
      postTool("createRefundRequest", body, "two"),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const approval = await ApprovalRequest.findOne();
    const decision = () =>
      request(app)
        .patch(`/api/v1/admin/approvals/${approval!.id}`)
        .auth(staffToken, { type: "bearer" })
        .send({ decision: "APPROVED", notes: "Verified damaged item" });
    const decisions = await Promise.all([decision(), decision()]);
    expect(decisions.map((response) => response.status).sort()).toEqual([200, 409]);
    const refund = await RefundRequest.findOne();
    expect(refund?.status).toBe("APPROVED");
    expect(refund?.completedAt).toBeUndefined();
    expect((await Order.findById(orderId))?.paymentStatus).toBe("PAID");
    expect(await Message.countDocuments({ senderType: "SYSTEM" })).toBe(1);
  });
  it("validates return item, quantity, cumulative requests, and delivery window", async () => {
    const body = { orderId, confirmed: true, reason: "Wrong size", productId, quantity: 2 };
    expect((await postTool("createReturnRequest", { ...body, quantity: 3 })).status).toBe(409);
    expect((await postTool("createReturnRequest", body)).status).toBe(200);
    expect((await postTool("createReturnRequest", body, "second-key")).status).toBe(409);
    expect(await ReturnRequest.countDocuments()).toBe(1);
    await Order.updateOne({ _id: orderId }, { deliveredAt: new Date(Date.now() - 40 * 86400000) });
    expect((await postTool("createReturnRequest", body, "third-key")).status).toBe(409);
  });
  it("requires staff claim before replying and never adds a fake AI echo", async () => {
    const reply = () =>
      request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .auth(staffToken, { type: "bearer" })
        .send({ content: "I can help with that." });
    expect((await reply()).status).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/conversations/${conversationId}`)
          .auth(staffToken, { type: "bearer" })
          .send({ action: "claim" })
      ).status,
    ).toBe(200);
    expect((await reply()).status).toBe(201);
    expect(await Message.countDocuments()).toBe(1);
    expect((await Message.findOne())?.senderType).toBe("AGENT");
  });
  it("captures failed runs and releases the conversation lease", async () => {
    // Drop only the isolated test index to simulate retrieval outage.
    await PolicyChunk.collection.dropIndex("content_text");
    try {
      const response = await request(app)
        .post("/api/v1/agent/chat")
        .auth(token, { type: "bearer" })
        .send({ conversationId, message: "What is your return policy?" });
      expect(response.status).toBe(500);
      expect((await AgentTrace.findOne())?.status).toBe("FAILED");
      expect((await Conversation.findById(conversationId))?.agentLeaseUntil).toBeUndefined();
      expect(await Message.countDocuments({ senderType: "CUSTOMER" })).toBe(1);
    } finally {
      await PolicyChunk.createIndexes();
    }
  });
  it("indexes queued documents and excludes archived/draft content", async () => {
    const document = await queueDocument({
      title: "Returns",
      content: "Headphones may be returned within thirty days of delivery.",
      sourceType: "POLICY",
    });
    expect(await lexicalSearch("headphones")).toHaveLength(0);
    await processNextDocument();
    expect(await lexicalSearch("headphones")).toHaveLength(1);
    await KnowledgeDocument.updateOne({ _id: document._id }, { status: "ARCHIVED" });
    expect(await lexicalSearch("headphones")).toHaveLength(0);
  });
});

describe("refresh-token sessions", () => {
  const login = () =>
    request(app)
      .post("/api/v1/auth/login")
      .send({ email: "customer@example.test", password: "demo-password" });
  const refresh = (refreshToken: string) =>
    request(app).post("/api/v1/auth/refresh").send({ refreshToken });

  beforeEach(async () => {
    await User.updateOne({ _id: userId }, { passwordHash: hashPassword("demo-password") });
  });

  it("rotates refresh tokens and revokes the whole family when one is reused", async () => {
    const first = (await login()).body.data;
    const second = (await refresh(first.refreshToken)).body.data;
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect((await refresh(first.refreshToken)).status).toBe(401);
    expect((await refresh(second.refreshToken)).status).toBe(401);
  });

  it("revokes the session on logout and ignores logout attempts by other users", async () => {
    const { accessToken, refreshToken } = (await login()).body.data;
    await request(app)
      .post("/api/v1/auth/logout")
      .auth(otherToken, { type: "bearer" })
      .send({ refreshToken });
    const rotated = (await refresh(refreshToken)).body.data;
    expect(rotated.refreshToken).toBeTruthy();
    await request(app)
      .post("/api/v1/auth/logout")
      .auth(accessToken, { type: "bearer" })
      .send({ refreshToken: rotated.refreshToken });
    expect((await refresh(rotated.refreshToken)).status).toBe(401);
  });

  it("rejects refresh tokens that were never issued by the server", async () => {
    const forged = signToken(
      { sub: userId, role: "CUSTOMER", type: "refresh", jti: "unknown", fam: "unknown" },
      "7d",
      env.JWT_REFRESH_SECRET,
    );
    expect((await refresh(forged)).status).toBe(401);
  });
});

describe("retrieval benchmark", () => {
  it("meets the lexical Recall@3 and MRR baseline on the bundled policy corpus", async () => {
    await ingestKnowledge();
    const ranked = await Promise.all(
      retrievalCases.map(async (testCase) =>
        (await lexicalSearch(testCase.query, 5)).map((hit) => hit.title),
      ),
    );
    const metrics = scoreRetrieval(ranked);
    console.info("retrieval baseline", metrics);
    expect(metrics.recallAt3).toBeGreaterThanOrEqual(0.9);
    expect(metrics.mrr).toBeGreaterThanOrEqual(0.75);
  });
});

describe("conversation ordering", () => {
  it("lists the most recent activity first and ignores future-dated timestamps", async () => {
    const customer = await Customer.findOne({ user: userId });
    const hourAgo = new Date(Date.now() - 3_600_000);
    await Conversation.create({
      customer: customer!._id,
      title: "Future dated",
      createdAt: hourAgo,
      lastMessageAt: new Date(Date.now() + 30 * 86_400_000),
    });
    await Conversation.create({
      customer: customer!._id,
      title: "Recent",
      lastMessageAt: new Date(Date.now() - 60_000),
    });
    const titles = (path: string, auth: string) =>
      request(app)
        .get(path)
        .auth(auth, { type: "bearer" })
        .then((response) => response.body.data.map((item: { title: string }) => item.title));
    for (const [path, auth] of [
      ["/api/v1/conversations", token],
      ["/api/v1/admin/conversations", staffToken],
    ] as const) {
      const order = await titles(path, auth);
      expect(order.indexOf("Recent")).toBeLessThan(order.indexOf("Future dated"));
    }
  });
});

describe("interrupted run recovery", () => {
  it("fails stale RUNNING traces and releases expired leases without touching fresh runs", async () => {
    const old = new Date(Date.now() - 10 * 60_000);
    await AgentTrace.create([
      { runId: "stale", agentType: "Supervisor", input: "x", status: "RUNNING", startedAt: old },
      {
        runId: "fresh",
        agentType: "Supervisor",
        input: "x",
        status: "RUNNING",
        startedAt: new Date(),
      },
    ]);
    await Conversation.updateOne(
      { _id: conversationId },
      { agentLeaseUntil: new Date(Date.now() - 1000) },
    );
    expect(await recoverInterruptedRuns()).toEqual({ runs: 1, leases: 1 });
    expect((await AgentTrace.findOne({ runId: "stale" }))?.status).toBe("FAILED");
    expect((await AgentTrace.findOne({ runId: "fresh" }))?.status).toBe("RUNNING");
    expect((await Conversation.findById(conversationId))?.agentLeaseUntil).toBeUndefined();
  });
});
