import { prisma } from "@/lib/prisma";
import type { PlatformAuditAction } from "@erp/platform-core";
import type { Prisma } from "@/generated/prisma";

export async function writePlatformAudit(input: {
  operatorId: string;
  action: PlatformAuditAction | string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}) {
  return prisma.platformAuditLog.create({
    data: {
      operatorId: input.operatorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      metadata: input.metadata ?? undefined,
      ip: input.ip,
      userAgent: input.userAgent,
    },
  });
}
