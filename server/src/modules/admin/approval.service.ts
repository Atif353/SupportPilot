import mongoose from "mongoose";
import { AppError } from "../../common/errors/AppError.js";
import { ApprovalRequest } from "../models/approval-request.model.js";
import { RefundRequest } from "../models/refund-request.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { Message } from "../models/message.model.js";
import { notifyConversation } from "../conversations/conversation.events.js";

export async function decideApproval(
  id: string,
  actorId: string,
  decision: "APPROVED" | "REJECTED",
  notes: string,
) {
  const approval = await mongoose.connection.transaction(async (session) => {
    const updated = await ApprovalRequest.findOneAndUpdate(
      {
        _id: id,
        status: "PENDING",
        requestedBy: { $ne: actorId },
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
      },
      { status: decision, resolvedBy: actorId, decisionNotes: notes, resolvedAt: new Date() },
      { new: true, session },
    );
    if (!updated)
      throw new AppError({
        message: "Approval is no longer pending, has expired, or requires another reviewer.",
        code: "CONFLICT",
        statusCode: 409,
      });
    const refundId = updated.payload.get("refundRequestId");
    if (updated.requestType !== "REFUND" || !refundId)
      throw new AppError({
        message:
          "This approval has no supported linked refund request. Resolve the data issue before reviewing it.",
        code: "CONFLICT",
        statusCode: 409,
      });
    if (refundId) {
      const refund = await RefundRequest.findOneAndUpdate(
        { _id: refundId, status: "REQUESTED" },
        { status: decision },
        { session },
      );
      if (!refund)
        throw new AppError({
          message: "Refund request is not awaiting review.",
          code: "CONFLICT",
          statusCode: 409,
        });
    }
    await AuditLog.create(
      [
        {
          actor: actorId,
          action: `APPROVAL_${decision}`,
          entityType: "ApprovalRequest",
          entityId: id,
          metadata: { notes },
        },
      ],
      { session },
    );
    if (updated.conversation)
      await Message.create(
        [
          {
            conversation: updated.conversation,
            senderType: "SYSTEM",
            content:
              decision === "APPROVED"
                ? `Refund approved for payment processing. Funds have not yet been sent. ${notes}`
                : `Refund request rejected. ${notes}`,
          },
        ],
        { session },
      );
    return updated.toObject();
  });
  if (approval.conversation) notifyConversation(String(approval.conversation));
  return approval;
}
