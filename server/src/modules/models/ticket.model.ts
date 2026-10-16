import { model, Schema } from "mongoose";
import { objectId } from "./common.js";

const ticketSchema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    customer: { type: objectId, ref: "Customer", required: true },
    order: { type: objectId, ref: "Order" },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      required: true,
      default: "MEDIUM",
    },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"],
      required: true,
      default: "OPEN",
    },
    assignedTo: { type: objectId, ref: "User" },
    tags: { type: [String], default: [] },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

ticketSchema.index({ customer: 1, status: 1, createdAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });

export const Ticket = model("Ticket", ticketSchema);
