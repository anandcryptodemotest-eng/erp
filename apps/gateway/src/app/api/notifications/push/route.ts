import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceSecret } from "@erp/auth";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/send";

const pushSchema = z.object({
  userId: z.string().optional(),
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

/** POST /api/notifications/push — compatibility wrapper around send command v1 (IN_APP + FCM). */
export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const senderId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  const serviceKey = request.headers.get("x-service-key");
  const serviceSecret = getServiceSecret();
  const isService = !!serviceSecret && serviceKey === serviceSecret;

  if (!tenantId || (!senderId && !isService)) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }
  if (!isService && !["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN"].includes(role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { userId, type, title, body: notifBody, metadata } = parsed.data;

  let recipientIds: string[];
  if (userId) {
    recipientIds = [userId];
  } else {
    const tenantUsers = await prisma.tenantUser.findMany({
      where: { tenantId, isActive: true },
      select: { userId: true },
    });
    recipientIds = tenantUsers.map((u) => u.userId);
  }

  if (recipientIds.length === 0) {
    return NextResponse.json({ data: { sent: 0, stored: 0, fcmSent: 0 } });
  }

  const result = await sendNotification(tenantId, {
    version: 1,
    type,
    title,
    body: notifBody,
    channels: ["IN_APP", "FCM"],
    recipients: recipientIds.map((id) => ({ userId: id })),
    metadata,
  });

  const stored = result.deliveries.filter((d) => d.channel === "IN_APP" && d.status === "SENT").length;
  const fcmSent = result.deliveries.filter((d) => d.channel === "FCM" && d.status === "SENT").length;

  return NextResponse.json({ data: { stored, fcmSent, sent: stored } });
}
