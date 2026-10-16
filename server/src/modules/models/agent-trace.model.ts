import { model, Schema } from "mongoose";
import { objectId } from "./common.js";

const agentTraceSchema = new Schema(
  {
    runId: { type: String, required: true, unique: true },
    conversation: { type: objectId, ref: "Conversation" },
    user: { type: objectId, ref: "User" },
    agentType: { type: String, required: true },
    input: { type: String, required: true },
    output: { type: String },
    toolCalls: { type: [String], default: [] },
    spans: {
      type: [{ name: String, latencyMs: Number, status: String, error: String }],
      default: [],
    },
    graphNodes: { type: [String], default: [] },
    routing: { type: String },
    guardrails: {
      type: [{ guard: String, action: String, detail: String, _id: false }],
      default: [],
    },
    model: { type: String },
    sources: { type: [String], default: [] },
    tokenUsage: { type: Map, of: Number, default: {} },
    latencyMs: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["RUNNING", "COMPLETED", "FAILED"],
      required: true,
      default: "RUNNING",
    },
    error: { type: String },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

agentTraceSchema.index({ conversation: 1, createdAt: -1 });
agentTraceSchema.index({ agentType: 1, status: 1 });

export const AgentTrace = model("AgentTrace", agentTraceSchema);
