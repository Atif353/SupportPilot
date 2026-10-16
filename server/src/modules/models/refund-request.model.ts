import { model, Schema } from "mongoose";
import { objectId } from "./common.js";

export const refundStatuses = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "PROCESSING",
  "COMPLETED",
] as const;

const refundRequestSchema = new Schema(
  {
    refundNumber: { type: String, required: true, unique: true },
    order: { type: objectId, ref: "Order", required: true },
    customer: { type: objectId, ref: "Customer", required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", uppercase: true },
    reason: { type: String, required: true },
    status: { type: String, enum: refundStatuses, required: true, default: "REQUESTED" },
    paymentReference: { type: String },
    requestedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

refundRequestSchema.index({ customer: 1, createdAt: -1 });
refundRequestSchema.index({ order: 1 });

export const RefundRequest = model("RefundRequest", refundRequestSchema);
