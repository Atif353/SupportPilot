import { createHash } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import { AppError } from "./errors/AppError.js";
import { IdempotencyKey } from "../modules/models/idempotency-key.model.js";
import { requiredString } from "./validation.js";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  return value;
}

// The key and domain writes commit together. MongoDB must run as a replica set.
export async function withIdempotency(
  actor: string,
  operation: string,
  rawKey: unknown,
  payload: unknown,
  execute: (session: ClientSession) => Promise<unknown>,
): Promise<unknown> {
  const clientKey = requiredString(rawKey, "Idempotency-Key", { max: 160 });
  const key = createHash("sha256")
    .update(JSON.stringify([actor, operation, clientKey]))
    .digest("hex");
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(canonical(payload)))
    .digest("hex");
  const replay = (record: { payloadHash?: string | null; result?: unknown }) => {
    if (record.payloadHash !== payloadHash)
      throw new AppError({
        message: "This request key was already used for different input.",
        code: "CONFLICT",
        statusCode: 409,
      });
    return record.result;
  };
  const existing = await IdempotencyKey.findOne({ key }).lean();
  if (existing) return replay(existing);
  try {
    return await mongoose.connection.transaction(async (session) => {
      const [record] = await IdempotencyKey.create(
        [{ key, operation, payloadHash, expiresAt: new Date(Date.now() + 86400000) }],
        { session },
      );
      const result = await execute(session);
      await IdempotencyKey.updateOne({ _id: record!._id }, { $set: { result } }, { session });
      return result;
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      const committed = await IdempotencyKey.findOne({ key }).lean();
      if (committed) return replay(committed);
    }
    throw error;
  }
}
