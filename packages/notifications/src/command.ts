import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_COMMAND_VERSION,
  type NotificationChannel,
  type NotificationRecipient,
  type NotificationSendCommand,
} from "./types";

export class NotificationCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationCommandError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseRecipient(raw: unknown, index: number): NotificationRecipient {
  const rec = asRecord(raw);
  if (!rec) throw new NotificationCommandError(`recipients[${index}] must be an object`);
  const recipient: NotificationRecipient = {};
  if (typeof rec.userId === "string" && rec.userId.trim()) recipient.userId = rec.userId.trim();
  if (typeof rec.email === "string" && rec.email.trim()) recipient.email = rec.email.trim();
  if (typeof rec.phone === "string" && rec.phone.trim()) recipient.phone = rec.phone.trim();
  if (typeof rec.telegramChatId === "string" && rec.telegramChatId.trim()) {
    recipient.telegramChatId = rec.telegramChatId.trim();
  }
  if (!recipient.userId && !recipient.email && !recipient.phone && !recipient.telegramChatId) {
    throw new NotificationCommandError(
      `recipients[${index}] needs userId, email, phone, or telegramChatId`
    );
  }
  return recipient;
}

function parseChannels(raw: unknown): NotificationChannel[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new NotificationCommandError("channels must be a non-empty array when provided");
  }
  const channels: NotificationChannel[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !NOTIFICATION_CHANNELS.includes(item as NotificationChannel)) {
      throw new NotificationCommandError(
        `Unknown channel "${String(item)}". Use ${NOTIFICATION_CHANNELS.join(", ")}`
      );
    }
    if (!channels.includes(item as NotificationChannel)) channels.push(item as NotificationChannel);
  }
  return channels;
}

function parseVariables(raw: unknown): Record<string, string> | undefined {
  if (raw === undefined) return undefined;
  const rec = asRecord(raw);
  if (!rec) throw new NotificationCommandError("variables must be an object");
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(rec)) {
    if (typeof value !== "string") {
      throw new NotificationCommandError(`variables.${key} must be a string`);
    }
    out[key] = value;
  }
  return out;
}

function parseMetadata(raw: unknown): Record<string, unknown> | undefined {
  if (raw === undefined) return undefined;
  const rec = asRecord(raw);
  if (!rec) throw new NotificationCommandError("metadata must be an object");
  return rec;
}

/** Parse the versioned Notification send command (v1). */
export function parseSendCommand(input: unknown): NotificationSendCommand {
  const rec = asRecord(input);
  if (!rec) throw new NotificationCommandError("Body must be a JSON object");

  const version = rec.version ?? NOTIFICATION_COMMAND_VERSION;
  if (version !== NOTIFICATION_COMMAND_VERSION) {
    throw new NotificationCommandError(
      `Unsupported notification command version ${String(version)} (expected ${NOTIFICATION_COMMAND_VERSION})`
    );
  }

  const type = typeof rec.type === "string" ? rec.type.trim() : "";
  const title = typeof rec.title === "string" ? rec.title.trim() : "";
  const body = typeof rec.body === "string" ? rec.body.trim() : "";
  if (!type) throw new NotificationCommandError("type is required");
  if (!title) throw new NotificationCommandError("title is required");
  if (!body) throw new NotificationCommandError("body is required");

  if (!Array.isArray(rec.recipients) || rec.recipients.length === 0) {
    throw new NotificationCommandError("recipients must be a non-empty array");
  }
  if (rec.recipients.length > 500) {
    throw new NotificationCommandError("recipients cannot exceed 500 per request");
  }

  const command: NotificationSendCommand = {
    version: NOTIFICATION_COMMAND_VERSION,
    type,
    title,
    body,
    recipients: rec.recipients.map(parseRecipient),
  };

  const channels = parseChannels(rec.channels);
  if (channels) command.channels = channels;
  const variables = parseVariables(rec.variables);
  if (variables) command.variables = variables;
  const metadata = parseMetadata(rec.metadata);
  if (metadata) command.metadata = metadata;
  if (typeof rec.idempotencyKey === "string" && rec.idempotencyKey.trim()) {
    command.idempotencyKey = rec.idempotencyKey.trim().slice(0, 128);
  }

  return command;
}

export function recipientAddress(
  channel: NotificationChannel,
  recipient: NotificationRecipient
): string | null {
  switch (channel) {
    case "IN_APP":
    case "FCM":
      return recipient.userId ?? null;
    case "EMAIL":
      return recipient.email ?? null;
    case "SMS":
    case "WHATSAPP":
      return recipient.phone ?? null;
    case "TELEGRAM":
      return recipient.telegramChatId ?? null;
  }
}

export function resolveChannels(
  requested: NotificationChannel[] | undefined,
  defaultChannels: NotificationChannel[],
  enabled: Record<NotificationChannel, { enabled: boolean }>
): NotificationChannel[] {
  const base = requested?.length ? requested : defaultChannels;
  return base.filter((ch) => enabled[ch]?.enabled !== false);
}
