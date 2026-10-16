import { model, Schema } from "mongoose";
import { objectId } from "./common.js";

const authSessionSchema = new Schema(
  {
    user: { type: objectId, ref: "User", required: true, index: true },
    tokenId: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedBy: { type: String },
  },
  { timestamps: true },
);

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthSession = model("AuthSession", authSessionSchema);
