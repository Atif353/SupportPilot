import { model, Schema } from "mongoose";
import { addressSchema, objectId } from "./common.js";

export const orderStatuses = [
  "PENDING",
  "PAYMENT_CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

const orderItemSchema = new Schema(
  {
    product: { type: objectId, ref: "Product", required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const shipmentEventSchema = new Schema(
  {
    status: { type: String, required: true },
    location: { type: String, required: true },
    description: { type: String, required: true },
    occurredAt: { type: Date, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true },
    customer: { type: objectId, ref: "Customer", required: true },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: (items: unknown[]) => items.length > 0,
    },
    subtotal: { type: Number, required: true, min: 0 },
    shippingCost: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "USD", uppercase: true },
    status: { type: String, enum: orderStatuses, required: true },
    paymentStatus: { type: String, enum: ["PENDING", "PAID", "REFUNDED"], required: true },
    shippingAddress: { type: addressSchema, required: true },
    trackingNumber: { type: String, trim: true },
    carrier: { type: String, trim: true },
    estimatedDeliveryAt: { type: Date },
    deliveredAt: { type: Date },
    shipmentHistory: { type: [shipmentEventSchema], default: [] },
  },
  { timestamps: true },
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

export const Order = model("Order", orderSchema);
