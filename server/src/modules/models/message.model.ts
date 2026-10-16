import { model, Schema } from "mongoose";
import { objectId } from "./common.js";

const messageSchema = new Schema(
  {
    conversation: { type: objectId, ref: "Conversation", required: true },
    senderType: { type: String, enum: ["CUSTOMER", "AGENT", "AI", "SYSTEM"], required: true },
    sender: { type: objectId, ref: "User" },
    content: { type: String, required: true },
    attachments: {
      type: [{ name: { type: String, required: true }, url: { type: String, required: true } }],
      default: [],
    },
    metadata: { type: Map, of: String, default: {} },
    citations: {
      type: [{ documentId: String, title: String, source: String, content: String, score: Number }],
      default: [],
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: 1 });

export const Message = model("Message", messageSchema);
