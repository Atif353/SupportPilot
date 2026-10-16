import { model, Schema } from "mongoose";
import { objectId } from "./common.js";

const approvalRequestSchema = new Schema(
  {
    requestType: {
      type: String,
      enum: ["REFUND", "RETURN", "CANCELLATION", "ORDER_UPDATE"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "EXPIRED"],
      required: true,
      default: "PENDING",
    },
    requestedBy: { type: objectId, ref: "User", required: true },
    resolvedBy: { type: objectId, ref: "User" },
    conversation: { type: objectId, ref: "Conversation" },
    ticket: { type: objectId, ref: "Ticket" },
    order: { type: objectId, ref: "Order" },
    payload: { type: Map, of: String, default: {} },
    decisionNotes: { type: String },
    resolvedAt: { type: Date },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

approvalRequestSchema.index({ status: 1, createdAt: -1 });
approvalRequestSchema.index({ requestedBy: 1, createdAt: -1 });

export const ApprovalRequest = model("ApprovalRequest", approvalRequestSchema);
