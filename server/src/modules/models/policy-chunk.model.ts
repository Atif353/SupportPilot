import { model, Schema } from "mongoose";
import { objectId } from "./common.js";

const policyChunkSchema = new Schema(
  {
    document: { type: objectId, ref: "KnowledgeDocument", required: true },
    chunkIndex: { type: Number, required: true, min: 0 },
    version: { type: Number, required: true, default: 1 },
    published: { type: Boolean, default: false },
    embeddingModel: { type: String, default: "none" },
    content: { type: String, required: true },
    embedding: { type: [Number], default: [] },
    tokenCount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

policyChunkSchema.index({ document: 1, version: 1, chunkIndex: 1 }, { unique: true });
policyChunkSchema.index({ content: "text" });

export const PolicyChunk = model("PolicyChunkV2", policyChunkSchema, "policychunksv2");
