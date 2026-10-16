import { model, Schema } from "mongoose";
import { objectId } from "./common.js";

const conversationSchema = new Schema(
  {
    customer: { type: objectId, ref: "Customer", required: true },
    ticket: { type: objectId, ref: "Ticket" },
    channel: { type: String, enum: ["WEB", "EMAIL", "CHAT"], required: true, default: "WEB" },
    status: {
      type: String,
      enum: ["OPEN", "WAITING", "RESOLVED", "CLOSED"],
      required: true,
      default: "OPEN",
    },
    assignedTo: { type: objectId, ref: "User" },
    title: { type: String, required: true },
    summary: { type: String },
    activeEntity: { type: String },
    lastMessageAt: { type: Date },
    agentLeaseUntil: { type: Date },
  },
  { timestamps: true },
);

conversationSchema.index({ customer: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ assignedTo: 1, status: 1 });

export const Conversation = model("Conversation", conversationSchema);
