export const NOTIFICATION_COMMAND_VERSION = 1 as const;

export const NOTIFICATION_CHANNELS = [
  "IN_APP",
  "FCM",
  "EMAIL",
  "SMS",
  "WHATSAPP",
  "TELEGRAM",
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const DELIVERY_STATUSES = ["QUEUED", "SENT", "SKIPPED", "FAILED", "DEAD"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const NOTIFICATION_MODES = ["DEMO", "LIVE"] as const;
export type NotificationMode = (typeof NOTIFICATION_MODES)[number];

export type NotificationRecipient = {
  userId?: string;
  email?: string;
  phone?: string;
  telegramChatId?: string;
};

export type NotificationSendCommand = {
  version: typeof NOTIFICATION_COMMAND_VERSION;
  type: string;
  title: string;
  body: string;
  channels?: NotificationChannel[];
  recipients: NotificationRecipient[];
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  variables?: Record<string, string>;
};

export type ChannelPolicy = {
  enabled: boolean;
};

export type NotificationPolicy = {
  mode: NotificationMode;
  defaultChannels: NotificationChannel[];
  channels: Record<NotificationChannel, ChannelPolicy>;
};

export type DeliveryRecord = {
  id: string;
  tenantId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
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
  metadata: Record<string, unknown> | null;
};

export type AdapterResult = {
  status: Extract<DeliveryStatus, "SENT" | "SKIPPED" | "FAILED">;
  provider: string;
  providerMessageId?: string | null;
  error?: string | null;
};

export type SendContext = {
  tenantId: string;
  channel: NotificationChannel;
  mode: NotificationMode;
  toAddress: string;
  userId: string | null;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export type DispatchResult = {
  idempotent: boolean;
  mode: NotificationMode;
  deliveries: Array<{
    id: string;
    channel: NotificationChannel;
    status: DeliveryStatus;
    toAddress: string | null;
    provider: string | null;
    error: string | null;
  }>;
};
