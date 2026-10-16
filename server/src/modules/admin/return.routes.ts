import { Router } from "express";
import { asRecord, objectId, oneOf, requiredString } from "../../common/validation.js";
import { ReturnRequest, returnStatuses } from "../models/return-request.model.js";
import { transitionReturn } from "./return.service.js";

export const returnAdminRouter = Router();
returnAdminRouter.get("/", async (req, res) => {
  const status =
    req.query.status === undefined ? undefined : oneOf(req.query.status, "status", returnStatuses);
  const requests = await ReturnRequest.find(status ? { status } : {})
    .populate("customer", "firstName lastName email")
    .populate("order", "orderNumber items")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ success: true, data: requests });
});
returnAdminRouter.patch("/:id", async (req, res) => {
  const body = asRecord(req.body);
  const action = oneOf(body.action, "action", [
    "approve",
    "reject",
    "receive",
    "complete",
  ] as const);
  const notes = requiredString(body.notes, "notes", { min: 3, max: 2000 });
  const result = await transitionReturn(objectId(req.params.id), req.auth!.sub, action, notes);
  res.json({ success: true, data: result });
});
