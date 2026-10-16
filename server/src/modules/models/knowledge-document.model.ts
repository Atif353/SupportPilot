import { model, Schema } from "mongoose";

const knowledgeDocumentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    sourceType: { type: String, enum: ["POLICY", "FAQ", "PRODUCT", "MANUAL"], required: true },
    sourceUrl: { type: String },
    content: { type: String, required: true },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      required: true,
      default: "DRAFT",
    },
    version: { type: Number, required: true, min: 1, default: 1 },
    tags: { type: [String], default: [] },
    contentHash: { type: String },
    indexStatus: {
      type: String,
      enum: ["QUEUED", "INDEXING", "READY", "FAILED"],
      default: "QUEUED",
    },
    indexError: { type: String },
    indexLeaseUntil: { type: Date },
    chunkCount: { type: Number, default: 0 },
    embeddingModel: { type: String },
  },
  { timestamps: true },
);

knowledgeDocumentSchema.index({ status: 1, sourceType: 1 });
knowledgeDocumentSchema.index({ title: "text", content: "text" });

export const KnowledgeDocument = model("KnowledgeDocument", knowledgeDocumentSchema);
