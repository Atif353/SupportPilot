import { model, Schema } from "mongoose";

const evaluationRunSchema = new Schema(
  {
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["QUEUED", "RUNNING", "COMPLETED", "FAILED"],
      required: true,
      default: "QUEUED",
    },
    dataset: { type: String, required: true },
    mode: { type: String, enum: ["FIXTURE"], default: "FIXTURE" },
    results: {
      type: [
        {
          id: String,
          prompt: String,
          expectedRoute: String,
          actualRoute: String,
          toolCalls: [String],
          response: String,
          routingPassed: Boolean,
          toolsPassed: Boolean,
          citationsPassed: Boolean,
          safetyPassed: Boolean,
          expectsCitation: Boolean,
          passed: Boolean,
          latencyMs: Number,
          error: String,
        },
      ],
      default: [],
    },
    metrics: { type: Map, of: Number, default: {} },
    startedAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true },
);

evaluationRunSchema.index({ status: 1, createdAt: -1 });

export const EvaluationRun = model("EvaluationRun", evaluationRunSchema);
