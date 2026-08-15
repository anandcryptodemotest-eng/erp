import { MAX_DELIVERY_ATTEMPTS } from "./constants";
import { recipientAddress, resolveChannels } from "./command";
import { renderTemplate } from "./render";
import type {
  AdapterResult,
  DeliveryRecord,
  DeliveryStatus,
  DispatchResult,
  NotificationPolicy,
  NotificationSendCommand,
  SendContext,
} from "./types";

export type DispatchDeps = {
  tenantId: string;
  loadPolicy: () => Promise<NotificationPolicy>;
  findByIdempotency: (key: string) => Promise<DeliveryRecord[] | null>;
  persist: (input: Omit<DeliveryRecord, "id"> & { id?: string }) => Promise<DeliveryRecord>;
  update: (
    id: string,
    patch: Partial<
      Pick<DeliveryRecord, "status" | "provider" | "providerMessageId" | "error" | "attemptCount">
    >
  ) => Promise<void>;
  send: (ctx: SendContext) => Promise<AdapterResult>;
};

function summarize(
  rows: DeliveryRecord[],
  mode: NotificationPolicy["mode"],
  idempotent: boolean
): DispatchResult {
  return {
    idempotent,
    mode,
    deliveries: rows.map((d) => ({
      id: d.id,
      channel: d.channel,
      status: d.status,
      toAddress: d.toAddress,
      provider: d.provider,
      error: d.error,
    })),
  };
}

export async function applyAdapterResult(
  row: DeliveryRecord,
  mode: NotificationPolicy["mode"],
  send: DispatchDeps["send"],
  update: DispatchDeps["update"]
): Promise<DeliveryRecord> {
  if (!row.toAddress) {
    const patch = {
      status: "FAILED" as const,
      provider: mode,
      error: "Missing recipient address for channel",
      attemptCount: row.attemptCount + 1,
    };
    await update(row.id, patch);
    return { ...row, ...patch, providerMessageId: row.providerMessageId };
  }

  let result: AdapterResult;
  try {
    result = await send({
      tenantId: row.tenantId,
      channel: row.channel,
      mode,
      toAddress: row.toAddress,
      userId: row.userId,
      type: row.type,
      title: row.title,
      body: row.body,
      metadata: row.metadata ?? undefined,
    });
  } catch (err) {
    result = {
      status: "FAILED",
      provider: mode,
      error: err instanceof Error ? err.message : "Send failed",
    };
  }

  const patch = {
    status: result.status,
    provider: result.provider,
    providerMessageId: result.providerMessageId ?? null,
    error: result.error ?? null,
    attemptCount: row.attemptCount + 1,
  };
  await update(row.id, patch);
  return { ...row, ...patch };
}

export async function dispatchSendCommand(
  command: NotificationSendCommand,
  deps: DispatchDeps
): Promise<DispatchResult> {
  const policy = await deps.loadPolicy();
  if (command.idempotencyKey) {
    const existing = await deps.findByIdempotency(command.idempotencyKey);
    if (existing && existing.length > 0) return summarize(existing, policy.mode, true);
  }

  const channels = resolveChannels(command.channels, policy.defaultChannels, policy.channels);
  if (channels.length === 0) {
    return { idempotent: false, mode: policy.mode, deliveries: [] };
  }

  const title = renderTemplate(command.title, command.variables);
  const body = renderTemplate(command.body, command.variables);
  const created: DeliveryRecord[] = [];

  for (const recipient of command.recipients) {
    for (const channel of channels) {
      const toAddress = recipientAddress(channel, recipient);
      const row = await deps.persist({
        tenantId: deps.tenantId,
        channel,
        status: "QUEUED",
        type: command.type,
        title,
        body,
        toAddress,
        userId: recipient.userId ?? null,
        provider: null,
        providerMessageId: null,
        error: null,
        attemptCount: 0,
        maxAttempts: MAX_DELIVERY_ATTEMPTS,
        idempotencyKey: command.idempotencyKey ?? null,
        commandVersion: command.version,
        metadata: command.metadata ?? null,
      });
      created.push(await applyAdapterResult(row, policy.mode, deps.send, deps.update));
    }
  }

  return summarize(created, policy.mode, false);
}

export function nextRetryStatus(attemptCount: number, maxAttempts = MAX_DELIVERY_ATTEMPTS): DeliveryStatus {
  return attemptCount >= maxAttempts ? "DEAD" : "QUEUED";
}

export async function retryDelivery(
  row: DeliveryRecord,
  deps: Pick<DispatchDeps, "update" | "send">,
  mode: NotificationPolicy["mode"]
): Promise<DeliveryRecord> {
  if (row.status !== "FAILED" && row.status !== "QUEUED") return row;
  if (row.attemptCount >= row.maxAttempts) {
    const patch = { status: "DEAD" as const, error: row.error ?? "Max attempts exceeded" };
    await deps.update(row.id, patch);
    return { ...row, ...patch };
  }
  return applyAdapterResult(row, mode, deps.send, deps.update);
}
