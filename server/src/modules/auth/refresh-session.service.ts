import { randomUUID } from "node:crypto";
import { AuthSession } from "../models/auth-session.model.js";
import {
  createAccessToken,
  createRefreshToken,
  refreshLifetimeSeconds,
  type AuthClaims,
} from "./auth.service.js";

type Subject = Pick<AuthClaims, "sub" | "role">;
export type IssuedTokens = { accessToken: string; refreshToken: string };

async function issue(
  subject: Subject,
  family: string,
): Promise<IssuedTokens & { tokenId: string }> {
  const tokenId = randomUUID();
  await AuthSession.create({
    user: subject.sub,
    tokenId,
    family,
    expiresAt: new Date(Date.now() + refreshLifetimeSeconds() * 1000),
  });
  return {
    tokenId,
    accessToken: createAccessToken(subject),
    refreshToken: createRefreshToken({ ...subject, jti: tokenId, fam: family }),
  };
}

export async function startSession(subject: Subject): Promise<IssuedTokens> {
  const { accessToken, refreshToken } = await issue(subject, randomUUID());
  return { accessToken, refreshToken };
}

/**
 * Rotates a refresh token. A token that was already rotated or revoked is treated as
 * stolen: the whole family is revoked and null is returned.
 */
export async function rotateSession(claims: AuthClaims): Promise<IssuedTokens | null> {
  if (!claims.jti || !claims.fam) return null;
  const consumed = await AuthSession.findOneAndUpdate(
    { tokenId: claims.jti, family: claims.fam, user: claims.sub, revokedAt: { $exists: false } },
    { revokedAt: new Date() },
  );
  if (!consumed) {
    await revokeFamily(claims.fam);
    return null;
  }
  const next = await issue({ sub: claims.sub, role: claims.role }, claims.fam);
  await AuthSession.updateOne({ tokenId: claims.jti }, { replacedBy: next.tokenId });
  return { accessToken: next.accessToken, refreshToken: next.refreshToken };
}

export async function revokeFamily(family: string): Promise<void> {
  await AuthSession.updateMany(
    { family, revokedAt: { $exists: false } },
    { revokedAt: new Date() },
  );
}
