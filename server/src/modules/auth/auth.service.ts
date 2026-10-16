import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";

export type AuthClaims = {
  sub: string;
  role: "CUSTOMER" | "SUPPORT" | "ADMIN";
  type: "access" | "refresh";
  exp: number;
  jti?: string;
  fam?: string;
};

const base64Url = (value: string): string => Buffer.from(value).toString("base64url");

const durationSeconds = (value: string): number => {
  const match = /^(\d+)([mhd])$/.exec(value);
  if (!match) return 900;
  const amount = Number(match[1]);
  return amount * ({ m: 60, h: 3600, d: 86400 }[match[2] as "m" | "h" | "d"] ?? 1);
};

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
};

export const verifyPassword = (password: string, storedHash: string): boolean => {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key || !/^[a-f\d]{128}$/i.test(key)) return false;
  const derivedKey = scryptSync(password, salt, 64);
  return timingSafeEqual(derivedKey, Buffer.from(key, "hex"));
};

export const signToken = (
  claims: Omit<AuthClaims, "exp">,
  expiresIn: string,
  secret: string,
): string => {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + durationSeconds(expiresIn) }),
  );
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
};

export const createAccessToken = (claims: Omit<AuthClaims, "exp" | "type">): string =>
  signToken({ ...claims, type: "access" }, env.JWT_ACCESS_EXPIRES_IN, env.JWT_ACCESS_SECRET);

export const refreshLifetimeSeconds = (): number => durationSeconds(env.JWT_REFRESH_EXPIRES_IN);

export const createRefreshToken = (
  claims: Omit<AuthClaims, "exp" | "type"> & { jti: string; fam: string },
): string =>
  signToken({ ...claims, type: "refresh" }, env.JWT_REFRESH_EXPIRES_IN, env.JWT_REFRESH_SECRET);

export const verifyToken = (token: string, expectedType: AuthClaims["type"]): AuthClaims | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    if (!encodedHeader || !encodedPayload || !signature) return null;
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as AuthClaims;
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString()) as {
      alg?: string;
      typ?: string;
    };
    if (
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      !/^[a-f\d]{24}$/i.test(payload.sub) ||
      !["CUSTOMER", "SUPPORT", "ADMIN"].includes(payload.role) ||
      !Number.isFinite(payload.exp)
    )
      return null;
    const secret = expectedType === "access" ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET;
    const expectedSignature = createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64url");
    if (
      signature.length !== expectedSignature.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature)) ||
      payload.type !== expectedType ||
      payload.exp <= Math.floor(Date.now() / 1000)
    )
      return null;
    return payload;
  } catch {
    return null;
  }
};
