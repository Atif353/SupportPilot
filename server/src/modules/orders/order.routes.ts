import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { getOrder, getTracking, listOrders } from "./order.controller.js";

export const orderRouter = Router();
orderRouter.use(requireAuth);
orderRouter.get("/", listOrders);
orderRouter.get("/:id", getOrder);
orderRouter.get("/:id/tracking", getTracking);
