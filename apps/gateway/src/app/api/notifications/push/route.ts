import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const pushSchema = z.object({
  // Target: either a single userId or broadcast to all users of the tenant
  userId: z.string().optional(),
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

// POST /api/notifications/push — create in-app record and send FCM push
export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const senderId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !senderId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }
  if (!["ADMIN", "MANAGER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { userId, type, title, body: notifBody, metadata } = parsed.data;

  // Determine recipient user IDs
  let recipientIds: string[];
  if (userId) {
    recipientIds = [userId];
  } else {
    // Broadcast: all active users in this tenant
    const tenantUsers = await prisma.tenantUser.findMany({
      where: { tenantId, isActive: true },
      select: { userId: true },
    });
    recipientIds = tenantUsers.map((u) => u.userId);
  }

  if (recipientIds.length === 0) {
    return NextResponse.json({ data: { sent: 0, stored: 0 } });
  }

  // Create in-app notification records
  await prisma.notification.createMany({
    data: recipientIds.map((uid) => ({
      tenantId,
      userId: uid,
      type,
      title,
      body: notifBody,
      metadata: metadata ?? undefined,
    })),
  });

  // Send FCM push notifications if server key is configured
  const fcmServerKey = process.env.FIREBASE_SERVER_KEY;
  let fcmSent = 0;

  if (fcmServerKey) {
    // Fetch active device tokens for all recipients
    const tokens = await prisma.fCMToken.findMany({
      where: { userId: { in: recipientIds }, tenantId, isActive: true },
      select: { token: true, userId: true },
    });

    if (tokens.length > 0) {
      // FCM Legacy HTTP API — send in batches of 500
      const BATCH = 500;
      for (let i = 0; i < tokens.length; i += BATCH) {
        const batch = tokens.slice(i, i + BATCH);
        const registrationIds = batch.map((t) => t.token);

        const fcmPayload = {
          registration_ids: registrationIds,
          notification: { title, body: notifBody },
          data: { type, ...(metadata ?? {}) },
        };

        const res = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify(fcmPayload),
        }).catch(() => null);

        if (res?.ok) {
          const result = await res.json().catch(() => null);
          fcmSent += result?.success ?? 0;

          // Deactivate tokens that FCM reports as invalid
          if (result?.results) {
            const invalidTokens: string[] = [];
            (result.results as Array<{ error?: string }>).forEach((r, idx) => {
              if (r.error === "NotRegistered" || r.error === "InvalidRegistration") {
                invalidTokens.push(registrationIds[idx]);
              }
            });
            if (invalidTokens.length > 0) {
              await prisma.fCMToken.updateMany({
                where: { token: { in: invalidTokens } },
                data: { isActive: false },
              });
            }
          }
        }
      }
    }
  }

  return NextResponse.json({
    data: { stored: recipientIds.length, fcmSent },
  });
}
