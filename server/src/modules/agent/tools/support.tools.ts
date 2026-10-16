import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";
import { AppError } from "../../../common/errors/AppError.js";
import { withIdempotency } from "../../../common/idempotency.js";
import { asRecord, objectId, requiredString } from "../../../common/validation.js";
import { requireCustomer, requireStaff } from "../../customer/customer.access.js";
import { assertConversationAccess } from "../../conversations/conversation.service.js";
import { notifyConversation } from "../../conversations/conversation.events.js";
import { AuditLog } from "../../models/audit-log.model.js";
import { ApprovalRequest } from "../../models/approval-request.model.js";
import { Conversation } from "../../models/conversation.model.js";
import { Order } from "../../models/order.model.js";
import { RefundRequest } from "../../models/refund-request.model.js";
import { ReturnRequest } from "../../models/return-request.model.js";
import { Ticket } from "../../models/ticket.model.js";
import { searchKnowledge } from "../../knowledge/knowledge.service.js";

const conflict = (message: string): never => {
  throw new AppError({ message, code: "CONFLICT", statusCode: 409 });
};
const confirmed = (input: Record<string, unknown>) => {
  if (input.confirmed !== true)
    throw new AppError({
      message: "Review and explicitly confirm this action.",
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
};

export async function scopedOrder(userId: string, role: string, id: string) {
  const filter = role === "CUSTOMER" ? { customer: (await requireCustomer(userId))._id } : {};
  if (role !== "CUSTOMER") requireStaff(role);
  const order = await Order.findOne({ _id: objectId(id, "orderId"), ...filter }).lean();
  if (!order)
    throw new AppError({ message: "Order not found.", code: "NOT_FOUND", statusCode: 404 });
  return order;
}

export const supportTools = {
  getCustomer: async (userId: string, _role: string) => requireCustomer(userId),
  getCustomerOrders: async (userId: string, _role: string) => {
    const customer = await requireCustomer(userId);
    return Order.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(20).lean();
  },
  getOrder: async (userId: string, role: string, input: unknown) =>
    scopedOrder(userId, role, objectId(asRecord(input).orderId, "orderId")),
  getOrderTracking: async (userId: string, role: string, input: unknown) => {
    const order = await supportTools.getOrder(userId, role, input);
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      shipmentHistory: order.shipmentHistory,
    };
  },
  searchKnowledgeBase: async (input: unknown) =>
    searchKnowledge(requiredString(asRecord(input).query, "query", { min: 2, max: 1000 })),
  updateShippingAddress: async (userId: string, role: string, input: unknown) => {
    const body = asRecord(input);
    confirmed(body);
    const order = await supportTools.getOrder(userId, role, body);
    const address = {
      ...order.shippingAddress,
      line1: requiredString(body.line1, "line1", { min: 3, max: 200 }),
      city: requiredString(body.city, "city", { min: 2, max: 100 }),
      state: requiredString(body.state, "state", { min: 2, max: 100 }),
      postalCode: requiredString(body.postalCode, "postalCode", { min: 3, max: 20 }),
    };
    return withIdempotency(
      userId,
      "updateShippingAddress",
      body.idempotencyKey,
      { orderId: String(order._id), address },
      async (session) => {
        const updated = await Order.findOneAndUpdate(
          { _id: order._id, status: { $in: ["PENDING", "PAYMENT_CONFIRMED"] } },
          { shippingAddress: address },
          { new: true, session },
        ).lean();
        if (!updated) conflict("Shipping address can no longer be changed.");
        await auditTool(userId, "UPDATE_SHIPPING_ADDRESS", String(order._id), {}, session);
        return updated;
      },
    );
  },
  cancelOrder: async (userId: string, role: string, input: unknown) => {
    const body = asRecord(input);
    confirmed(body);
    const order = await supportTools.getOrder(userId, role, body);
    return withIdempotency(
      userId,
      "cancelOrder",
      body.idempotencyKey,
      { orderId: String(order._id) },
      async (session) => {
        const updated = await Order.findOneAndUpdate(
          { _id: order._id, status: { $in: ["PENDING", "PAYMENT_CONFIRMED"] } },
          { status: "CANCELLED" },
          { new: true, session },
        ).lean();
        if (!updated) conflict("This order can no longer be cancelled.");
        await auditTool(userId, "CANCEL_ORDER", String(order._id), {}, session);
        return updated;
      },
    );
  },
  createReturnRequest: async (userId: string, role: string, input: unknown) => {
    const body = asRecord(input);
    confirmed(body);
    const order = await supportTools.getOrder(userId, role, body);
    const productId = objectId(body.productId, "productId");
    const quantity = Number(body.quantity);
    const item = order.items.find((entry) => String(entry.product) === productId);
    if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity)
      conflict("Select a purchased item and a valid quantity.");
    const reason = requiredString(body.reason, "reason", { min: 3, max: 2000 });
    return withIdempotency(
      userId,
      "createReturnRequest",
      body.idempotencyKey,
      { orderId: String(order._id), productId, quantity, reason },
      async (session) => {
        // Updating the order serializes concurrent return/refund checks for this order.
        const current = await Order.findOneAndUpdate(
          {
            _id: order._id,
            status: "DELIVERED",
            deliveredAt: { $gte: new Date(Date.now() - 30 * 86400000) },
          },
          { $inc: { __v: 1 } },
          { session, new: true },
        );
        if (!current) conflict("Returns require an order delivered within the last 30 days.");
        const previous = await ReturnRequest.find({ order: order._id, status: { $ne: "REJECTED" } })
          .session(session)
          .lean();
        const returned = previous
          .flatMap((request) => request.items)
          .filter((entry) => String(entry.product) === productId)
          .reduce((sum, entry) => sum + entry.quantity, 0);
        if (returned + quantity > item!.quantity)
          conflict("This quantity has already been requested for return.");
        const [request] = await ReturnRequest.create(
          [
            {
              returnNumber: `RET-${randomUUID()}`,
              order: order._id,
              customer: order.customer,
              items: [{ product: productId, quantity }],
              reason,
            },
          ],
          { session },
        );
        await auditTool(userId, "CREATE_RETURN", request!.id, {}, session);
        return request!.toObject();
      },
    );
  },
  createRefundRequest: async (userId: string, role: string, input: unknown) => {
    const body = asRecord(input);
    confirmed(body);
    const order = await supportTools.getOrder(userId, role, body);
    const reason = requiredString(body.reason, "reason", { min: 3, max: 2000 });
    const conversationId =
      body.conversationId === undefined
        ? undefined
        : objectId(body.conversationId, "conversationId");
    if (conversationId) {
      const conversation = await assertConversationAccess(userId, role, conversationId);
      if (String(conversation.customer) !== String(order.customer))
        conflict("Conversation and order must belong to the same customer.");
    }
    return withIdempotency(
      userId,
      "createRefundRequest",
      body.idempotencyKey,
      { orderId: String(order._id), reason, conversationId },
      async (session) => {
        const current = await Order.findOneAndUpdate(
          { _id: order._id, paymentStatus: "PAID" },
          { $inc: { __v: 1 } },
          { session, new: true },
        );
        if (!current) conflict("Only paid orders can be submitted for refund review.");
        if (
          await RefundRequest.exists({ order: order._id, status: { $ne: "REJECTED" } }).session(
            session,
          )
        )
          conflict("A refund request already exists for this order.");
        const [request] = await RefundRequest.create(
          [
            {
              refundNumber: `REF-${randomUUID()}`,
              order: order._id,
              customer: order.customer,
              amount: order.total,
              currency: order.currency,
              reason,
            },
          ],
          { session },
        );
        const [approval] = await ApprovalRequest.create(
          [
            {
              requestType: "REFUND",
              requestedBy: userId,
              order: order._id,
              conversation: conversationId,
              payload: {
                refundRequestId: request!.id,
                amount: String(order.total),
                currency: order.currency,
                reason,
              },
            },
          ],
          { session },
        );
        await auditTool(userId, "REQUEST_REFUND_APPROVAL", approval!.id, {}, session);
        return {
          requiresApproval: true,
          refundRequest: request!.toObject(),
          approvalRequest: approval!.toObject(),
        };
      },
    );
  },
  createSupportTicket: async (userId: string, _role: string, input: unknown) => {
    const body = asRecord(input);
    const customer = await requireCustomer(userId);
    const data = {
      subject: requiredString(body.subject, "subject", { min: 3, max: 200 }),
      description: requiredString(body.description, "description", { min: 3, max: 4000 }),
      category: requiredString(body.category, "category", { max: 100 }),
    };
    return withIdempotency(
      userId,
      "createSupportTicket",
      body.idempotencyKey,
      data,
      async (session) => {
        const [ticket] = await Ticket.create(
          [
            {
              ...data,
              ticketNumber: `TKT-${randomUUID()}`,
              customer: customer._id,
              priority: "MEDIUM",
              status: "OPEN",
            },
          ],
          { session },
        );
        return ticket!.toObject();
      },
    );
  },
  escalateToHuman: async (userId: string, conversationId: string, role = "CUSTOMER") => {
    await assertConversationAccess(userId, role, conversationId);
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, status: { $in: ["OPEN", "WAITING"] } },
      { status: "WAITING" },
      { new: true },
    ).lean();
    if (!conversation) conflict("This conversation is closed.");
    notifyConversation(conversationId);
    return { status: "WAITING", conversationId };
  },
};

export async function auditTool(
  userId: string,
  action: string,
  entityId: string,
  metadata: Record<string, string>,
  session?: ClientSession,
): Promise<void> {
  await AuditLog.create(
    [{ actor: userId, action, entityType: "SupportTool", entityId, metadata }],
    session ? { session } : {},
  );
}
