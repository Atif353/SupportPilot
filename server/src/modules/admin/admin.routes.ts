import { Router } from "express";
import { AppError } from "../../common/errors/AppError.js";
import { errorCodes } from "../../common/errors/errorCodes.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { ApprovalRequest } from "../models/approval-request.model.js";
import { AgentTrace } from "../models/agent-trace.model.js";
import { Customer } from "../models/customer.model.js";
import { Order } from "../models/order.model.js";
import { Ticket } from "../models/ticket.model.js";
import { Conversation } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { asRecord, objectId, oneOf, requiredString } from "../../common/validation.js";
import { decideApproval } from "./approval.service.js";
import { transitionConversation } from "../conversations/conversation.workflow.js";
import { listRecentConversations } from "../conversations/conversation.service.js";
import { returnAdminRouter } from "./return.routes.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN", "SUPPORT"));
adminRouter.use("/returns", returnAdminRouter);
adminRouter.get("/approvals", async (_req, res) =>
  res.json({
    success: true,
    data: await ApprovalRequest.find()
      .populate("order", "orderNumber total currency")
      .populate("requestedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  }),
);
adminRouter.patch("/approvals/:id", async (req, res) => {
  const id = objectId(req.params.id);
  const body = asRecord(req.body);
  const decision = oneOf(body.decision, "decision", ["APPROVED", "REJECTED"] as const);
  const notes = requiredString(body.notes, "notes", { min: 3, max: 2000 });
  const actorId = req.auth?.sub;
  if (!actorId)
    throw new AppError({
      message: "Authentication is required.",
      code: errorCodes.UNAUTHORIZED,
      statusCode: 401,
    });
  res.json({ success: true, data: await decideApproval(id, actorId, decision, notes) });
});
adminRouter.get("/traces", async (_req, res) =>
  res.json({
    success: true,
    data: await AgentTrace.find().sort({ createdAt: -1 }).limit(100).lean(),
  }),
);
adminRouter.get("/customers", async (_req, res) =>
  res.json({
    success: true,
    data: await Customer.find().sort({ createdAt: -1 }).limit(100).lean(),
  }),
);
adminRouter.get("/orders", async (_req, res) =>
  res.json({
    success: true,
    data: await Order.find().populate("customer").sort({ createdAt: -1 }).limit(100).lean(),
  }),
);
adminRouter.get("/tickets", async (_req, res) =>
  res.json({
    success: true,
    data: await Ticket.find()
      .populate("customer assignedTo")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  }),
);
adminRouter.get("/conversations", async (_req, res) =>
  res.json({
    success: true,
    data: await listRecentConversations({}, { populate: "customer assignedTo" }),
  }),
);
adminRouter.get("/conversations/:id", async (req, res) => {
  const conversation = await Conversation.findById(objectId(req.params.id))
    .populate("customer assignedTo")
    .populate({ path: "ticket", populate: { path: "order" } })
    .lean();
  if (!conversation)
    throw new AppError({ message: "Conversation not found.", code: "NOT_FOUND", statusCode: 404 });
  const messages = conversation
    ? await Message.find({ conversation: conversation._id }).sort({ createdAt: 1 }).lean()
    : [];
  const traces = conversation
    ? await AgentTrace.find({ conversation: conversation._id }).sort({ createdAt: -1 }).lean()
    : [];
  res.json({ success: true, data: { conversation, messages, traces } });
});
adminRouter.get("/metrics", async (_req, res) => {
  const [conversations, approvals, traces, tickets] = await Promise.all([
    Conversation.countDocuments(),
    ApprovalRequest.countDocuments({ status: "PENDING" }),
    AgentTrace.countDocuments(),
    Ticket.countDocuments({ status: { $in: ["OPEN", "IN_PROGRESS"] } }),
  ]);
  res.json({ success: true, data: { conversations, approvals, traces, tickets } });
});
adminRouter.patch("/conversations/:id", async (req, res) => {
  const id = objectId(req.params.id);
  const body = asRecord(req.body);
  const action = oneOf(body.action, "action", ["claim", "release", "resolve", "reopen"] as const);
  const conversation = await transitionConversation(id, req.auth!.sub, req.auth!.role, action);
  res.json({ success: true, data: conversation });
});
adminRouter.patch("/tickets/:id", async (req, res) => {
  const body = asRecord(req.body);
  const status = oneOf(body.status, "status", [
    "OPEN",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
  ] as const);
  const ticket = await Ticket.findByIdAndUpdate(
    objectId(req.params.id),
    { status, assignedTo: req.auth!.sub },
    { new: true, runValidators: true },
  );
  if (!ticket)
    throw new AppError({ message: "Ticket not found.", code: "NOT_FOUND", statusCode: 404 });
  res.json({ success: true, data: ticket });
});
