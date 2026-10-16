import { model, Schema } from "mongoose";
import { objectId } from "./common.js";

const auditLogSchema = new Schema(
  {
    actor: { type: objectId, ref: "User" },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    metadata: { type: Map, of: String, default: {} },
    ipAddress: { type: String },
  },
  { timestamps: true },
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

export const AuditLog = model("AuditLog", auditLogSchema);
