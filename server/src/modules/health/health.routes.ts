import { Router } from "express";
import { getHealth } from "./health.controller.js";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { PolicyChunk } from "../models/policy-chunk.model.js";

export const healthRouter = Router();

healthRouter.get("/", getHealth);
healthRouter.get("/ready", async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db)
      throw new Error("Database unavailable.");
    const topology = await mongoose.connection.db.admin().command({ hello: 1, maxTimeMS: 2000 });
    if (!topology.setName && topology.msg !== "isdbgrid")
      throw new Error("Transactions unavailable.");
    if (env.KNOWLEDGE_SEARCH_MODE === "hybrid") {
      const indexes = await PolicyChunk.collection
        .listSearchIndexes("policy_chunks_vector", { maxTimeMS: 2000 })
        .toArray();
      if (!indexes.some((index) => "queryable" in index && index.queryable === true))
        throw new Error("Vector index unavailable.");
    }
    res.json({ success: true, data: { status: "ready", searchMode: env.KNOWLEDGE_SEARCH_MODE } });
  } catch {
    res.status(503).json({
      success: false,
      error: {
        code: "NOT_READY",
        message: "Database or configured search index is unavailable.",
      },
    });
  }
});
