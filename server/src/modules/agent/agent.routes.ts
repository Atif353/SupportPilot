import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { runAgent } from "./agent.controller.js";
import { agentRateLimit } from "../../common/middleware/rateLimit.js";

export const agentRouter = Router();
agentRouter.post("/chat", requireAuth, requireRole("CUSTOMER"), agentRateLimit, runAgent);
