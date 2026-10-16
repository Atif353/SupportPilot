import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { EvaluationRun } from "../models/evaluation-run.model.js";
import { runEvaluation } from "./evaluation.service.js";

export const evaluationRouter = Router();
evaluationRouter.use(requireAuth, requireRole("ADMIN", "SUPPORT"));
evaluationRouter.get("/", async (_req, res) =>
  res.json({
    success: true,
    data: await EvaluationRun.find().sort({ createdAt: -1 }).limit(30).lean(),
  }),
);
evaluationRouter.post("/run", async (_req, res) =>
  res.status(201).json({ success: true, data: await runEvaluation() }),
);
