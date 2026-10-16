import mongoose from "mongoose";
import { AppError } from "../../common/errors/AppError.js";
import { ReturnRequest } from "../models/return-request.model.js";
import { AuditLog } from "../models/audit-log.model.js";

const transitions = {
  approve: { from: "REQUESTED", to: "APPROVED" },
  reject: { from: "REQUESTED", to: "REJECTED" },
  receive: { from: "APPROVED", to: "RECEIVED" },
  complete: { from: "RECEIVED", to: "COMPLETED" },
} as const;
export type ReturnAction = keyof typeof transitions;

export async function transitionReturn(
  id: string,
  actorId: string,
  action: ReturnAction,
  notes: string,
) {
  const { from, to } = transitions[action];
  return mongoose.connection.transaction(async (session) => {
    const now = new Date();
    const updated = await ReturnRequest.findOneAndUpdate(
      { _id: id, status: from },
      {
        $set: {
          status: to,
          resolutionNotes: notes,
          ...(["REJECTED", "COMPLETED"].includes(to) ? { resolvedAt: now } : {}),
        },
        $push: { history: { status: to, notes, changedBy: actorId, changedAt: now } },
      },
      { new: true, runValidators: true, session },
    );
    if (!updated)
      throw new AppError({
        message:
          "This return is no longer eligible for that action. Refresh to see its current status.",
        code: "CONFLICT",
        statusCode: 409,
      });
    await AuditLog.create(
      [
        {
          actor: actorId,
          action: `RETURN_${to}`,
          entityType: "ReturnRequest",
          entityId: id,
          metadata: { from, to, notes },
        },
      ],
      { session },
    );
    return updated.toObject();
  });
}
