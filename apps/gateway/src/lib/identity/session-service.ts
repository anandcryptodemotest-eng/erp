import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";

export type SessionMeta = {
  device?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * SessionService — create, validate, rotate and revoke refresh tokens.
 * Refresh tokens are stored hashed (SHA-256); only the raw value is returned
 * to the client, matching the existing auth flow.
 */
export async function createSession(userId: string, meta: SessionMeta = {}) {
  const raw = generateToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      device: meta.device ?? null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });
  return raw;
}

/** Validate a raw refresh token; returns the stored row (revoked/expired → null). */
export async function validateToken(raw: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  });
  if (!stored || stored.isRevoked || stored.expiresAt < new Date()) return null;
  return stored;
}

export async function markTokenUsed(id: string) {
  await prisma.refreshToken.update({ where: { id }, data: { lastUsedAt: new Date() } });
}

/** Revoke a single refresh token (by raw value). Returns true when found. */
export async function revokeToken(raw: string): Promise<boolean> {
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!stored) return false;
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { isRevoked: true, revokedAt: new Date() },
  });
  return true;
}

/** Revoke all active refresh tokens for a user (logout-all-devices). */
export async function revokeAllTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date() },
  });
}
