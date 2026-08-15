import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type NotificationChannel } from "@erp/notifications";
import { loadNotificationChannelConfig, saveNotificationChannels } from "@/lib/notifications/policy";

const channelEnum = z.enum(["IN_APP", "FCM", "EMAIL", "SMS", "WHATSAPP", "TELEGRAM"]);

const enabledSchema = z
  .object({
    IN_APP: z.boolean().optional(),
    FCM: z.boolean().optional(),
    EMAIL: z.boolean().optional(),
    SMS: z.boolean().optional(),
    WHATSAPP: z.boolean().optional(),
    TELEGRAM: z.boolean().optional(),
  })
  .optional();

const saveSchema = z.object({
  mode: z.enum(["DEMO", "LIVE"]).optional(),
  defaultChannels: z.array(channelEnum).optional(),
  enabled: enabledSchema,
  email: z
    .object({
      from: z.string().optional(),
      smtpHost: z.string().optional(),
      smtpPort: z.number().int().positive().optional(),
      smtpUser: z.string().optional(),
      smtpSecure: z.boolean().optional(),
      smtpPassword: z.string().optional(),
    })
    .optional(),
  telegramBotToken: z.string().optional(),
});

function requireAdmin(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return { error: NextResponse.json({ error: "Auth context required" }, { status: 400 }) };
  }
  if (!["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN"].includes(role ?? "")) {
    return { error: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }) };
  }
  return { tenantId };
}

/** GET /api/notifications/channels — tenant channel policy (no secrets). */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const data = await loadNotificationChannelConfig(auth.tenantId!);
  return NextResponse.json({ data });
}

/** PUT /api/notifications/channels — save DEMO/LIVE policy and connector settings. */
export async function PUT(request: NextRequest) {
  const auth = requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const data = await saveNotificationChannels(auth.tenantId!, {
    ...parsed.data,
    enabled: parsed.data.enabled as Partial<Record<NotificationChannel, boolean>> | undefined,
  });
  return NextResponse.json({ data });
}
