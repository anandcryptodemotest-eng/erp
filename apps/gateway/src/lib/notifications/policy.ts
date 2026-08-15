import {
  DEFAULT_NOTIFICATION_POLICY,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EMAIL_PROVIDER,
  NOTIFICATION_PROVIDER,
  NOTIFICATION_TELEGRAM_PROVIDER,
  type NotificationChannel,
  type NotificationMode,
  type NotificationPolicy,
} from "@erp/notifications";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, lastFourOfSecret } from "@/lib/integrations/crypto";

export type NotificationChannelConfig = {
  policy: NotificationPolicy;
  email: {
    from: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpSecure: boolean;
    hasPassword: boolean;
    passwordLastFour: string | null;
  };
  telegram: {
    hasBotToken: boolean;
    botTokenLastFour: string | null;
  };
};

type StoredConfig = {
  mode?: NotificationMode;
  defaultChannels?: NotificationChannel[];
  channels?: Partial<Record<NotificationChannel, { enabled?: boolean }>>;
  email?: {
    from?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpSecure?: boolean;
  };
};

function asConfig(value: unknown): StoredConfig {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as StoredConfig)
    : {};
}

function mergePolicy(stored: StoredConfig): NotificationPolicy {
  const channels = { ...DEFAULT_NOTIFICATION_POLICY.channels };
  for (const ch of NOTIFICATION_CHANNELS) {
    if (stored.channels?.[ch]?.enabled === false) channels[ch] = { enabled: false };
    if (stored.channels?.[ch]?.enabled === true) channels[ch] = { enabled: true };
  }
  const defaults = stored.defaultChannels?.filter((ch) =>
    NOTIFICATION_CHANNELS.includes(ch)
  );
  return {
    mode: stored.mode === "LIVE" ? "LIVE" : "DEMO",
    defaultChannels: defaults?.length ? defaults : DEFAULT_NOTIFICATION_POLICY.defaultChannels,
    channels,
  };
}

async function readSecret(tenantId: string, provider: string, keyName: string) {
  const row = await prisma.tenantIntegrationSecret.findUnique({
    where: { tenantId_provider_keyName: { tenantId, provider, keyName } },
  });
  if (!row) return { value: null as string | null, lastFour: null as string | null };
  return { value: decryptSecret(row), lastFour: row.lastFour };
}

export async function loadNotificationPolicy(tenantId: string): Promise<NotificationPolicy> {
  const row = await prisma.tenantIntegration.findUnique({
    where: { tenantId_provider: { tenantId, provider: NOTIFICATION_PROVIDER } },
  });
  return mergePolicy(asConfig(row?.config));
}

export async function loadNotificationChannelConfig(tenantId: string): Promise<NotificationChannelConfig> {
  const row = await prisma.tenantIntegration.findUnique({
    where: { tenantId_provider: { tenantId, provider: NOTIFICATION_PROVIDER } },
  });
  const stored = asConfig(row?.config);
  const [smtp, telegram] = await Promise.all([
    readSecret(tenantId, NOTIFICATION_EMAIL_PROVIDER, "smtp_password"),
    readSecret(tenantId, NOTIFICATION_TELEGRAM_PROVIDER, "bot_token"),
  ]);
  return {
    policy: mergePolicy(stored),
    email: {
      from: stored.email?.from ?? "",
      smtpHost: stored.email?.smtpHost ?? "",
      smtpPort: stored.email?.smtpPort ?? 587,
      smtpUser: stored.email?.smtpUser ?? "",
      smtpSecure: stored.email?.smtpSecure ?? false,
      hasPassword: Boolean(smtp.value),
      passwordLastFour: smtp.lastFour,
    },
    telegram: {
      hasBotToken: Boolean(telegram.value),
      botTokenLastFour: telegram.lastFour,
    },
  };
}

export async function loadSmtpPassword(tenantId: string): Promise<string | null> {
  const { value } = await readSecret(tenantId, NOTIFICATION_EMAIL_PROVIDER, "smtp_password");
  return value;
}

export async function loadTelegramBotToken(tenantId: string): Promise<string | null> {
  const { value } = await readSecret(tenantId, NOTIFICATION_TELEGRAM_PROVIDER, "bot_token");
  return value;
}

async function upsertSecret(tenantId: string, provider: string, keyName: string, plaintext: string) {
  const enc = encryptSecret(plaintext);
  await prisma.tenantIntegrationSecret.upsert({
    where: { tenantId_provider_keyName: { tenantId, provider, keyName } },
    create: {
      tenantId,
      provider,
      keyName,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
      lastFour: lastFourOfSecret(plaintext),
    },
    update: {
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
      lastFour: lastFourOfSecret(plaintext),
    },
  });
}

export type SaveNotificationChannelsInput = {
  mode?: NotificationMode;
  defaultChannels?: NotificationChannel[];
  enabled?: Partial<Record<NotificationChannel, boolean>>;
  email?: {
    from?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpSecure?: boolean;
    smtpPassword?: string;
  };
  telegramBotToken?: string;
};

export async function saveNotificationChannels(
  tenantId: string,
  input: SaveNotificationChannelsInput
): Promise<NotificationChannelConfig> {
  const existing = await prisma.tenantIntegration.findUnique({
    where: { tenantId_provider: { tenantId, provider: NOTIFICATION_PROVIDER } },
  });
  const prev = asConfig(existing?.config);
  const policy = mergePolicy(prev);
  if (input.mode) policy.mode = input.mode;
  if (input.defaultChannels?.length) policy.defaultChannels = input.defaultChannels;
  if (input.enabled) {
    for (const ch of NOTIFICATION_CHANNELS) {
      if (typeof input.enabled[ch] === "boolean") policy.channels[ch] = { enabled: input.enabled[ch]! };
    }
  }
  const email = {
    from: input.email?.from ?? prev.email?.from ?? "",
    smtpHost: input.email?.smtpHost ?? prev.email?.smtpHost ?? "",
    smtpPort: input.email?.smtpPort ?? prev.email?.smtpPort ?? 587,
    smtpUser: input.email?.smtpUser ?? prev.email?.smtpUser ?? "",
    smtpSecure: input.email?.smtpSecure ?? prev.email?.smtpSecure ?? false,
  };
  const config = {
    mode: policy.mode,
    defaultChannels: policy.defaultChannels,
    channels: policy.channels,
    email,
  } satisfies StoredConfig;

  await prisma.tenantIntegration.upsert({
    where: { tenantId_provider: { tenantId, provider: NOTIFICATION_PROVIDER } },
    create: {
      tenantId,
      provider: NOTIFICATION_PROVIDER,
      status: "CONNECTED",
      config: config as Prisma.InputJsonValue,
    },
    update: {
      status: "CONNECTED",
      lastError: null,
      config: config as Prisma.InputJsonValue,
    },
  });

  if (input.email?.smtpPassword?.trim()) {
    await upsertSecret(tenantId, NOTIFICATION_EMAIL_PROVIDER, "smtp_password", input.email.smtpPassword.trim());
  }
  if (input.telegramBotToken?.trim()) {
    await upsertSecret(tenantId, NOTIFICATION_TELEGRAM_PROVIDER, "bot_token", input.telegramBotToken.trim());
  }

  return loadNotificationChannelConfig(tenantId);
}
