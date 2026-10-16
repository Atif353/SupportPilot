import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { asRecord, objectId, oneOf, requiredString } from "../../common/validation.js";
import { searchKnowledge } from "./knowledge.service.js";
import { KnowledgeDocument } from "../models/knowledge-document.model.js";
import { ingestKnowledge, queueDocument } from "./knowledge.ingest.js";
import { AppError } from "../../common/errors/AppError.js";
import { PolicyChunk } from "../models/policy-chunk.model.js";

export const knowledgeRouter = Router();
knowledgeRouter.get("/search", requireAuth, async (req, res) => {
  const query = requiredString(req.query.q, "q", { min: 2, max: 1000 });
  res.json({ success: true, data: await searchKnowledge(query) });
});
knowledgeRouter.get("/", requireAuth, requireRole("ADMIN", "SUPPORT"), async (_req, res) => {
  res.json({
    success: true,
    data: await KnowledgeDocument.find()
      .select("-content")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean(),
  });
});
knowledgeRouter.post("/documents", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const body = asRecord(req.body);
  const title = requiredString(body.title, "title", { max: 200 });
  const content = requiredString(body.content, "content", { min: 20, max: 200000 });
  const sourceType = oneOf(body.sourceType, "sourceType", [
    "POLICY",
    "FAQ",
    "PRODUCT",
    "MANUAL",
  ] as const);
  const document = await queueDocument({ title, content, sourceType });
  res
    .status(202)
    .json({ success: true, data: { _id: document.id, indexStatus: document.indexStatus } });
});
knowledgeRouter.patch("/documents/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const action = oneOf(asRecord(req.body).action, "action", ["archive", "retry"] as const);
  const document = await mongoose.connection.transaction(async (session) => {
    const changed = await KnowledgeDocument.findOneAndUpdate(
      { _id: objectId(req.params.id), indexStatus: { $ne: "INDEXING" } },
      action === "archive"
        ? { status: "ARCHIVED" }
        : {
            status: "DRAFT",
            indexStatus: "QUEUED",
            $inc: { version: 1 },
            $unset: { indexError: 1 },
          },
      { new: true, session },
    );
    if (changed)
      await PolicyChunk.updateMany({ document: changed._id }, { published: false }, { session });
    return changed;
  });
  if (!document)
    throw new AppError({
      message: "Document not found or currently indexing.",
      code: "CONFLICT",
      statusCode: 409,
    });
  res.json({
    success: true,
    data: { _id: document.id, status: document.status, indexStatus: document.indexStatus },
  });
});
knowledgeRouter.post("/ingest", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  res.json({ success: true, data: await ingestKnowledge() });
});
