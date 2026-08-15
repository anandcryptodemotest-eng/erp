import {
  dispatchSendCommand,
  retryDelivery,
  type DeliveryRecord,
  type NotificationChannel,
  type NotificationSendCommand,
} from "@erp/notifications";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { loadNotificationPolicy } from "./policy";
import { sendOnChannel } from "./adapters";

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toRecord(row: {
  id: string;
  tenantId: string;
  channel: string;
  status: string;
  type: string;
  title: string;
  body: string;
  toAddress: string | null;
  userId: string | null;
  provider: string | null;
  providerMessageId: string | null;
  error: string | null;
  attemptCount: number;
  maxAttempts: number;
  idempotencyKey: string | null;
  commandVersion: number;
  metadata: Prisma.JsonValue | null;
}): DeliveryRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    channel: row.channel as NotificationChannel,
    status: row.status as DeliveryRecord["status"],
    type: row.type,
    title: row.title,
    body: row.body,
    toAddress: row.toAddress,
    userId: row.userId,
    provider: row.provider,
    providerMessageId: row.providerMessageId,
    error: row.error,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    idempotencyKey: row.idempotencyKey,
    commandVersion: row.commandVersion,
    metadata: asRecord(row.metadata),
  };
}

async function enrichRecipients(command: NotificationSendCommand): Promise<NotificationSendCommand> {
  const userIds = command.recipients.map((r) => r.userId).filter((id): id is string => Boolean(id));
  if (userIds.length === 0) return command;
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, phoneNormalized: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return {
    ...command,
    recipients: command.recipients.map((r) => {
      if (!r.userId) return r;
      const user = byId.get(r.userId);
      if (!user) return r;
      return {
        ...r,
        email: r.email || user.email || undefined,
        phone: r.phone || user.phoneNormalized || undefined,
      };
    }),
  };
}

function persistDeps(tenantId: string) {
  return {
    tenantId,
    loadPolicy: () => loadNotificationPolicy(tenantId),
    findByIdempotency: async (key: string) => {
      const rows = await prisma.notificationDelivery.findMany({
        where: { tenantId, idempotencyKey: key },
        orderBy: { createdAt: "asc" },
      });
      return rows.length ? rows.map(toRecord) : null;
    },
    persist: async (input: Omit<DeliveryRecord, "id"> & { id?: string }) => {
      const row = await prisma.notificationDelivery.create({
        data: {
          tenantId: input.tenantId,
          channel: input.channel,
          status: input.status,
          type: input.type,
          title: input.title,
          body: input.body,
          toAddress: input.toAddress,
          userId: input.userId,
          provider: input.provider,
          providerMessageId: input.providerMessageId,
          error: input.error,
          attemptCount: input.attemptCount,
          maxAttempts: input.maxAttempts,
          idempotencyKey: input.idempotencyKey,
          commandVersion: input.commandVersion,
          metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
        },
      });
      return toRecord(row);
    },
    update: async (
      id: string,
      patch: Partial<
        Pick<DeliveryRecord, "status" | "provider" | "providerMessageId" | "error" | "attemptCount">
      >
    ) => {
      await prisma.notificationDelivery.update({
        where: { id },
        data: {
          ...patch,
          sentAt: patch.status === "SENT" ? new Date() : undefined,
        },
      });
    },
    send: sendOnChannel,
  };
}

export async function sendNotification(tenantId: string, command: NotificationSendCommand) {
  const enriched = await enrichRecipients(command);
  return dispatchSendCommand(enriched, persistDeps(tenantId));
}

export async function retryNotificationDelivery(tenantId: string, deliveryId: string) {
  const row = await prisma.notificationDelivery.findFirst({ where: { id: deliveryId, tenantId } });
  if (!row) return null;
  const policy = await loadNotificationPolicy(tenantId);
  const updated = await retryDelivery(toRecord(row), persistDeps(tenantId), policy.mode);
  return updated;
}
