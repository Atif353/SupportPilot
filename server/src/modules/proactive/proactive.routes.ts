import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { runDelayedOrderSweep } from "./proactive.service.js";

export const proactiveRouter = Router();
proactiveRouter.post(
  "/delayed-orders/run",
  requireAuth,
  requireRole("ADMIN", "SUPPORT"),
  async (_req, res) => res.json({ success: true, data: await runDelayedOrderSweep() }),
);
