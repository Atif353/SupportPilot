import { AppError } from "../../common/errors/AppError.js";
import mongoose from "mongoose";
import { objectId, requiredString } from "../../common/validation.js";
import { requireCustomer, requireStaff } from "../customer/customer.access.js";
import { Conversation } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { notifyConversation } from "./conversation.events.js";

export async function assertConversationAccess(userId: string, role: string, id: string) {
  const filter = role === "CUSTOMER" ? { customer: (await requireCustomer(userId))._id } : {};
  if (role !== "CUSTOMER") requireStaff(role);
  const conversation = await Conversation.findOne({ _id: objectId(id), ...filter }).lean();
  if (!conversation)
    throw new AppError({ message: "Conversation not found.", code: "NOT_FOUND", statusCode: 404 });
  return conversation;
}

/**
 * Newest activity first. A lastMessageAt in the future (bad clock, imported or seeded data)
 * is ignored in favour of createdAt so it cannot pin a conversation to the top.
 */
export async function listRecentConversations(
  filter: Record<string, unknown>,
  options: { populate?: string; limit?: number } = {},
) {
  const ranked = await Conversation.aggregate<{ _id: mongoose.Types.ObjectId }>([
    { $match: filter },
    {
      $addFields: {
        activityAt: {
          $cond: [
            { $gt: ["$lastMessageAt", "$$NOW"] },
            "$createdAt",
            { $ifNull: ["$lastMessageAt", "$createdAt"] },
          ],
        },
      },
    },
    { $sort: { activityAt: -1, _id: -1 } },
    { $limit: options.limit ?? 100 },
    { $project: { _id: 1 } },
  ]);
  const query = Conversation.find({ _id: { $in: ranked.map((row) => row._id) } });
  const found = await (options.populate ? query.populate(options.populate) : query).lean();
  const position = new Map(ranked.map((row, index) => [String(row._id), index]));
  return found.sort(
    (left, right) => (position.get(String(left._id)) ?? 0) - (position.get(String(right._id)) ?? 0),
  );
}

export async function listConversations(userId: string, role: string) {
  const filter = role === "CUSTOMER" ? { customer: (await requireCustomer(userId))._id } : {};
  if (role !== "CUSTOMER") requireStaff(role);
  return listRecentConversations(filter);
}

export async function createConversation(userId: string, title: string) {
  const customer = await requireCustomer(userId);
  return Conversation.create({
    customer: customer._id,
    channel: "WEB",
    status: "OPEN",
    title,
    lastMessageAt: new Date(),
  });
}

export async function getConversationMessages(userId: string, role: string, id: string) {
  await assertConversationAccess(userId, role, id);
  const messages = await Message.find({ conversation: id })
    .sort({ createdAt: -1, _id: -1 })
    .limit(200)
    .lean();
  return messages.reverse();
}

export async function createConversationMessage(
  userId: string,
  role: string,
  id: string,
  content: string,
) {
  const conversation = await assertConversationAccess(userId, role, id);
  if (role === "SUPPORT" && String(conversation.assignedTo) !== userId)
    throw new AppError({
      message: "Claim this conversation before replying.",
      code: "FORBIDDEN",
      statusCode: 403,
    });
  if (["CLOSED", "RESOLVED"].includes(conversation.status))
    throw new AppError({
      message: "Reopen this conversation before replying.",
      code: "CONFLICT",
      statusCode: 409,
    });
  const text = requiredString(content, "content", { max: 4000 });
  const message = await mongoose.connection.transaction(async (session) => {
    const writable = await Conversation.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ["OPEN", "WAITING"] },
        ...(role === "SUPPORT" ? { assignedTo: userId } : {}),
      },
      { $set: { lastMessageAt: new Date() }, $inc: { __v: 1 } },
      { session },
    );
    if (!writable)
      throw new AppError({
        message: "This conversation is no longer available for replies.",
        code: "CONFLICT",
        statusCode: 409,
      });
    const [created] = await Message.create(
      [
        {
          conversation: id,
          senderType: role === "CUSTOMER" ? "CUSTOMER" : "AGENT",
          sender: userId,
          content: text,
        },
      ],
      { session },
    );
    return created!.toObject();
  });
  notifyConversation(id);
  return { message };
}
