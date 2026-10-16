import { AppError } from "./errors/AppError.js";
import { errorCodes } from "./errors/errorCodes.js";

const objectIdPattern = /^[a-f\d]{24}$/i;

const invalid = (message: string, details?: unknown): never => {
  throw new AppError({
    message,
    code: errorCodes.VALIDATION_ERROR,
    statusCode: 400,
    details,
  });
};

export const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("Request body must be an object.");
  return value as Record<string, unknown>;
};

export const requiredString = (
  value: unknown,
  field: string,
  options: { min?: number; max?: number; trim?: boolean } = {},
): string => {
  if (typeof value !== "string") invalid(`${field} must be a string.`);
  const stringValue = value as string;
  const result = options.trim === false ? stringValue : stringValue.trim();
  if (result.length < (options.min ?? 1))
    invalid(`${field} must be at least ${options.min ?? 1} characters.`);
  if (options.max !== undefined && result.length > options.max)
    invalid(`${field} must be at most ${options.max} characters.`);
  return result;
};

export const objectId = (value: unknown, field = "id"): string => {
  const result = requiredString(value, field);
  if (!objectIdPattern.test(result)) invalid(`${field} must be a valid id.`);
  return result;
};

export const email = (value: unknown): string => {
  const result = requiredString(value, "email").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(result)) invalid("email must be valid.");
  return result;
};

export const oneOf = <T extends string>(value: unknown, field: string, values: readonly T[]): T => {
  const result = requiredString(value, field);
  if (!values.includes(result as T)) invalid(`${field} is not supported.`);
  return result as T;
};

export const envString = (
  value: string | undefined,
  fallback?: string,
  name = "environment variable",
): string => {
  const result = value ?? fallback;
  if (!result?.trim())
    throw new Error(
      `Missing required environment variable: ${name}. Set it in server/.env, the workspace .env, or your shell environment.`,
    );
  return result;
};

export const envPositiveInteger = (
  value: string | undefined,
  fallback: number,
  name = "environment variable",
): number => {
  const result = Number(value ?? fallback);
  if (!Number.isInteger(result) || result <= 0)
    throw new Error(`${name} must be a positive integer.`);
  return result;
};
