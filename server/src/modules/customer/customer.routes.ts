import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { Customer } from "../models/customer.model.js";
import { ReturnRequest } from "../models/return-request.model.js";
import { Ticket } from "../models/ticket.model.js";
import { RefundRequest } from "../models/refund-request.model.js";
import { requireCustomer } from "./customer.access.js";

export const customerRouter = Router();
customerRouter.use(requireAuth);
customerRouter.get("/refunds", async (req, res) => {
  const customer = await requireCustomer(req.auth!.sub);
  res.json({
    success: true,
    data: await RefundRequest.find({ customer: customer._id })
      .populate("order", "orderNumber")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  });
});
customerRouter.get("/profile", async (req, res) =>
  res.json({ success: true, data: await Customer.findOne({ user: req.auth?.sub }).lean() }),
);
customerRouter.get("/returns", async (req, res) => {
  const customer = await Customer.findOne({ user: req.auth?.sub }).select("_id").lean();
  res.json({
    success: true,
    data: customer
      ? await ReturnRequest.find({ customer: customer._id })
          .populate("order")
          .sort({ createdAt: -1 })
          .lean()
      : [],
  });
});
customerRouter.get("/tickets", async (req, res) => {
  const customer = await Customer.findOne({ user: req.auth?.sub }).select("_id").lean();
  res.json({
    success: true,
    data: customer
      ? await Ticket.find({ customer: customer._id }).sort({ createdAt: -1 }).lean()
      : [],
  });
});
