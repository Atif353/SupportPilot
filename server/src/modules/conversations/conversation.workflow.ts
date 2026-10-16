import mongoose from "mongoose";
import { AppError } from "../../common/errors/AppError.js";
import { Conversation } from "../models/conversation.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { notifyConversation } from "./conversation.events.js";

export type ConversationAction = "claim" | "release" | "resolve" | "reopen";

export async function transitionConversation(
  id: string,
  actorId: string,
  role: string,
  action: ConversationAction,
) {
  const assignment =
    action === "claim"
      ? { $or: [{ assignedTo: null }, { assignedTo: actorId }] }
      : role === "ADMIN"
        ? {}
        : { assignedTo: actorId };
  const status =
    action === "reopen" ? { $in: ["RESOLVED", "CLOSED"] } : { $in: ["OPEN", "WAITING"] };
  const update =
    action === "claim"
      ? { assignedTo: actorId, status: "OPEN" }
      : action === "release"
        ? { assignedTo: null, status: "WAITING" }
        : { status: action === "resolve" ? "RESOLVED" : "WAITING" };
  const conversation = await mongoose.connection.transaction(async (session) => {
    const changed = await Conversation.findOneAndUpdate(
      {
        _id: id,
        status,
        $and: [
          assignment,
          { $or: [{ agentLeaseUntil: null }, { agentLeaseUntil: { $lte: new Date() } }] },
        ],
      },
      { $set: update, $inc: { __v: 1 } },
      { new: true, session },
    );
    if (!changed)
      throw new AppError({
        message:
          "This conversation changed, is processing a message, or belongs to another agent. Refresh before trying again.",
        code: "CONFLICT",
        statusCode: 409,
      });
    await AuditLog.create(
      [
        {
          actor: actorId,
          action: `CONVERSATION_${action.toUpperCase()}`,
          entityType: "Conversation",
          entityId: id,
        },
      ],
      { session },
    );
    return changed.toObject();
  });
  notifyConversation(id);
  return conversation;
}
