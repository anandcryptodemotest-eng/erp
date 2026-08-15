import type { NotificationChannel, NotificationPolicy } from "./types";

export const NOTIFICATION_PROVIDER = "NOTIFICATION";
export const NOTIFICATION_EMAIL_PROVIDER = "NOTIFICATION_EMAIL";
export const NOTIFICATION_TELEGRAM_PROVIDER = "NOTIFICATION_TELEGRAM";

export const MAX_DELIVERY_ATTEMPTS = 5;

export const DEFAULT_NOTIFICATION_POLICY: NotificationPolicy = {
  mode: "DEMO",
  defaultChannels: ["IN_APP"],
  channels: {
    IN_APP: { enabled: true },
    FCM: { enabled: true },
    EMAIL: { enabled: true },
    SMS: { enabled: true },
    WHATSAPP: { enabled: true },
    TELEGRAM: { enabled: true },
  },
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  IN_APP: "In-app",
  FCM: "Push (FCM)",
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
};
