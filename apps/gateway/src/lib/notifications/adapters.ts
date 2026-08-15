import { formatOutboundText, type AdapterResult, type SendContext } from "@erp/notifications";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { sendQuickSms, sendSessionSimple } from "@/lib/integrations/fast2sms";
import {
  FAST2SMS_PROVIDER,
  getIntegrationRow,
  loadApiKey,
} from "@/lib/integrations/whatsapp-integration-service";
import { loadNotificationChannelConfig, loadSmtpPassword, loadTelegramBotToken } from "./policy";
import { sendSmtpEmail } from "./smtp";

function demoResult(channel: string): AdapterResult {
  return { status: "SENT", provider: "DEMO", providerMessageId: `demo-${channel}` };
}

async function sendInApp(ctx: SendContext): Promise<AdapterResult> {
  await prisma.notification.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.toAddress,
      type: ctx.type,
      title: ctx.title,
      body: ctx.body,
      metadata: ctx.metadata ? (ctx.metadata as Prisma.InputJsonValue) : undefined,
    },
  });
  return { status: "SENT", provider: "IN_APP", providerMessageId: ctx.toAddress };
}

async function sendFcm(ctx: SendContext): Promise<AdapterResult> {
  const fcmServerKey = process.env.FIREBASE_SERVER_KEY;
  if (!fcmServerKey) return { status: "SKIPPED", provider: "FCM", error: "FIREBASE_SERVER_KEY not set" };

  const tokens = await prisma.fCMToken.findMany({
    where: { userId: ctx.toAddress, tenantId: ctx.tenantId, isActive: true },
    select: { token: true },
  });
  if (tokens.length === 0) return { status: "SKIPPED", provider: "FCM", error: "No device tokens" };

  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${fcmServerKey}`,
    },
    body: JSON.stringify({
      registration_ids: tokens.map((t) => t.token),
      notification: { title: ctx.title, body: ctx.body },
      data: { type: ctx.type, ...(ctx.metadata ?? {}) },
    }),
  }).catch(() => null);

  if (!res?.ok) return { status: "FAILED", provider: "FCM", error: "FCM HTTP error" };
  const result = (await res.json().catch(() => null)) as { success?: number } | null;
  return { status: "SENT", provider: "FCM", providerMessageId: String(result?.success ?? 0) };
}

async function sendEmail(ctx: SendContext): Promise<AdapterResult> {
  const cfg = await loadNotificationChannelConfig(ctx.tenantId);
  if (!cfg.email.from || !cfg.email.smtpHost) {
    return { status: "FAILED", provider: "SMTP", error: "SMTP from/host not configured" };
  }
  const password = await loadSmtpPassword(ctx.tenantId);
  if (!password && cfg.email.smtpUser) {
    return { status: "FAILED", provider: "SMTP", error: "SMTP password not configured" };
  }
  const messageId = await sendSmtpEmail({
    host: cfg.email.smtpHost,
    port: cfg.email.smtpPort,
    secure: cfg.email.smtpSecure,
    user: cfg.email.smtpUser || undefined,
    password: password ?? undefined,
    from: cfg.email.from,
    to: ctx.toAddress,
    subject: ctx.title,
    text: ctx.body,
  });
  return { status: "SENT", provider: "SMTP", providerMessageId: messageId ?? null };
}

async function sendSms(ctx: SendContext): Promise<AdapterResult> {
  const apiKey = await loadApiKey(ctx.tenantId);
  if (!apiKey) return { status: "FAILED", provider: "FAST2SMS", error: "Fast2SMS API key not configured" };
  const numbers = ctx.toAddress.replace(/\D/g, "").slice(-10);
  if (numbers.length !== 10) {
    return { status: "FAILED", provider: "FAST2SMS", error: "SMS needs a 10-digit Indian mobile" };
  }
  const raw = await sendQuickSms({
    apiKey,
    message: formatOutboundText(ctx.title, ctx.body).slice(0, 1000),
    numbers,
  });
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const requestId = rec.request_id ?? rec.message_id ?? rec.message;
  return { status: "SENT", provider: "FAST2SMS", providerMessageId: requestId ? String(requestId) : null };
}

async function sendWhatsApp(ctx: SendContext): Promise<AdapterResult> {
  const apiKey = await loadApiKey(ctx.tenantId);
  if (!apiKey) return { status: "FAILED", provider: FAST2SMS_PROVIDER, error: "Fast2SMS API key not configured" };
  const integration = await getIntegrationRow(ctx.tenantId);
  const config =
    integration?.config && typeof integration.config === "object"
      ? (integration.config as { phoneNumberId?: string })
      : {};
  if (!config.phoneNumberId) {
    return { status: "FAILED", provider: FAST2SMS_PROVIDER, error: "WhatsApp phone number ID not selected" };
  }
  const digits = ctx.toAddress.replace(/\D/g, "");
  const e164 = digits.length === 10 ? `91${digits}` : digits;
  const sent = await sendSessionSimple({
    apiKey,
    phoneNumberId: config.phoneNumberId,
    to: e164,
    payload: {
      type: "text",
      text: formatOutboundText(ctx.title, ctx.body),
      udf1: "erp-notify",
    },
  });
  return {
    status: "SENT",
    provider: FAST2SMS_PROVIDER,
    providerMessageId: sent.messageId ?? sent.requestId,
  };
}

async function sendTelegram(ctx: SendContext): Promise<AdapterResult> {
  const token = await loadTelegramBotToken(ctx.tenantId);
  if (!token) return { status: "FAILED", provider: "TELEGRAM", error: "Telegram bot token not configured" };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ctx.toAddress,
      text: formatOutboundText(ctx.title, ctx.body),
    }),
  }).catch(() => null);
  if (!res) return { status: "FAILED", provider: "TELEGRAM", error: "Telegram network error" };
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; result?: { message_id?: number }; description?: string }
    | null;
  if (!res.ok || !body?.ok) {
    return { status: "FAILED", provider: "TELEGRAM", error: body?.description || `Telegram HTTP ${res.status}` };
  }
  return {
    status: "SENT",
    provider: "TELEGRAM",
    providerMessageId: body.result?.message_id != null ? String(body.result.message_id) : null,
  };
}

export async function sendOnChannel(ctx: SendContext): Promise<AdapterResult> {
  if (ctx.channel === "IN_APP") return sendInApp(ctx);
  if (ctx.channel === "FCM") return sendFcm(ctx);
  if (ctx.mode === "DEMO") return demoResult(ctx.channel);

  switch (ctx.channel) {
    case "EMAIL":
      return sendEmail(ctx);
    case "SMS":
      return sendSms(ctx);
    case "WHATSAPP":
      return sendWhatsApp(ctx);
    case "TELEGRAM":
      return sendTelegram(ctx);
    default:
      return { status: "FAILED", provider: "UNKNOWN", error: `Unsupported channel ${ctx.channel}` };
  }
}
