import { prisma } from "@/lib/prisma";
import type { CredentialType } from "../../generated/prisma";

/**
 * CredentialService — thin data access for AuthCredential rows.
 * A user holds at most one credential per type (enforced by schema unique).
 */
export async function findCredentialByProvider(type: CredentialType, providerId: string) {
  return prisma.authCredential.findUnique({
    where: { type_providerId: { type, providerId } },
    include: { user: true },
  });
}

export async function findPasswordCredential(userId: string) {
  return prisma.authCredential.findFirst({
    where: { userId, type: "PASSWORD" },
  });
}

export async function findCredentialOfType(userId: string, type: CredentialType) {
  return prisma.authCredential.findFirst({ where: { userId, type } });
}

export async function createCredential(data: {
  userId: string;
  type: CredentialType;
  providerId?: string | null;
  passwordHash?: string | null;
}) {
  return prisma.authCredential.create({ data });
}

export async function updateCredentialLastUsed(id: string) {
  return prisma.authCredential.update({ where: { id }, data: { lastUsedAt: new Date() } });
}

/** Replace the user's password credential (create or update). */
export async function upsertPasswordCredential(userId: string, passwordHash: string) {
  const existing = await findPasswordCredential(userId);
  if (existing) {
    return prisma.authCredential.update({
      where: { id: existing.id },
      data: { passwordHash, lastUsedAt: new Date() },
    });
  }
  return prisma.authCredential.create({
    data: { userId, type: "PASSWORD", passwordHash },
  });
}
