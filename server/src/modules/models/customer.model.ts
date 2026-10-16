import { model, Schema } from "mongoose";
import { addressSchema, objectId } from "./common.js";

const customerSchema = new Schema(
  {
    user: { type: objectId, ref: "User", required: true, unique: true },
    customerNumber: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    addresses: { type: [addressSchema], default: [] },
    tags: { type: [String], default: [] },
    lifetimeValue: { type: Number, default: 0, min: 0 },
    orderCount: { type: Number, default: 0, min: 0 },
    lastOrderAt: { type: Date },
    preferences: {
      emailUpdates: { type: Boolean, default: true },
      smsUpdates: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

customerSchema.index({ email: 1 });
customerSchema.index({ lastName: 1, firstName: 1 });

export const Customer = model("Customer", customerSchema);
