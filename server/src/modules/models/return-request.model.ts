import { model, Schema } from "mongoose";
import { objectId } from "./common.js";

export const returnStatuses = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "RECEIVED",
  "COMPLETED",
] as const;

const returnRequestSchema = new Schema(
  {
    returnNumber: { type: String, required: true, unique: true },
    order: { type: objectId, ref: "Order", required: true },
    customer: { type: objectId, ref: "Customer", required: true },
    items: {
      type: [
        {
          product: { type: objectId, ref: "Product", required: true },
          quantity: { type: Number, required: true, min: 1 },
        },
      ],
      required: true,
    },
    reason: { type: String, required: true },
    status: { type: String, enum: returnStatuses, required: true, default: "REQUESTED" },
    resolutionNotes: { type: String },
    requestedAt: { type: Date, required: true, default: Date.now },
    resolvedAt: { type: Date },
    history: {
      type: [
        {
          status: { type: String, enum: returnStatuses, required: true },
          notes: { type: String, required: true },
          changedBy: { type: objectId, ref: "User", required: true },
          changedAt: { type: Date, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

returnRequestSchema.index({ customer: 1, createdAt: -1 });
returnRequestSchema.index({ order: 1 });

export const ReturnRequest = model("ReturnRequest", returnRequestSchema);
