import type { Request, Response } from "express";
import { AppError } from "../../common/errors/AppError.js";
import { errorCodes } from "../../common/errors/errorCodes.js";
import { objectId } from "../../common/validation.js";
import { Customer } from "../models/customer.model.js";
import { Order } from "../models/order.model.js";

const customerFilter = async (req: Request): Promise<Record<string, unknown>> => {
  if (!req.auth)
    throw new AppError({
      message: "Authentication is required.",
      code: errorCodes.UNAUTHORIZED,
      statusCode: 401,
    });
  if (req.auth.role !== "CUSTOMER") return {};
  const customer = await Customer.findOne({ user: req.auth.sub }).select("_id").lean();
  if (!customer)
    throw new AppError({
      message: "Customer profile not found.",
      code: errorCodes.NOT_FOUND,
      statusCode: 404,
    });
  return { customer: customer._id };
};

export const listOrders = async (req: Request, res: Response): Promise<void> => {
  const orders = await Order.find(await customerFilter(req))
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ success: true, data: orders });
};

export const getOrder = async (req: Request, res: Response): Promise<void> => {
  const id = objectId(req.params.id);
  const order = await Order.findOne({ _id: id, ...(await customerFilter(req)) }).lean();
  if (!order)
    throw new AppError({
      message: "Order not found.",
      code: errorCodes.NOT_FOUND,
      statusCode: 404,
    });
  res.json({ success: true, data: order });
};

export const getTracking = async (req: Request, res: Response): Promise<void> => {
  const id = objectId(req.params.id);
  const order = await Order.findOne({ _id: id, ...(await customerFilter(req)) })
    .select("orderNumber status trackingNumber carrier estimatedDeliveryAt shipmentHistory")
    .lean();
  if (!order)
    throw new AppError({
      message: "Order not found.",
      code: errorCodes.NOT_FOUND,
      statusCode: 404,
    });
  res.json({ success: true, data: order });
};
