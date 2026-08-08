import { prisma } from "./prisma";
import type { Prisma } from "../generated/prisma";

export type AuditEventInput = {
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonObject;
};

export async function recordAuditEvent(request: Request, input: AuditEventInput) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return null;

  return prisma.auditEvent.create({
    data: {
      tenantId,
      actorId: request.headers.get("x-user-id") ?? request.headers.get("x-operator-id"),
      actorRole: request.headers.get("x-user-role") ?? request.headers.get("x-operator-role"),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      requestId: request.headers.get("x-request-id"),
      correlationId: request.headers.get("x-correlation-id"),
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent"),
    },
  });
}