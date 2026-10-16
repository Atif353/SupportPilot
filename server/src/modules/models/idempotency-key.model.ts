import { model, Schema } from "mongoose";
import { objectId } from "./common.js";

const idempotencyKeySchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    operation: { type: String, required: true },
    payloadHash: { type: String },
    result: { type: Schema.Types.Mixed },
    resourceId: { type: objectId },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyKey = model("IdempotencyKey", idempotencyKeySchema);
