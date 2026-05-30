import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ANDROID", "IOS", "WEB"]),
});

// POST /api/notifications/fcm — register a device token
export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Upsert: activate if previously deactivated, create if new
  const record = await prisma.fCMToken.upsert({
    where: { userId_token: { userId, token: parsed.data.token } },
    update: { isActive: true, platform: parsed.data.platform, tenantId },
    create: { tenantId, userId, token: parsed.data.token, platform: parsed.data.platform },
  });

  return NextResponse.json({ data: record }, { status: 201 });
}

// DELETE /api/notifications/fcm — unregister a device token
export async function DELETE(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token query param required" }, { status: 400 });

  const existing = await prisma.fCMToken.findFirst({ where: { userId, token, tenantId } });
  if (!existing) return NextResponse.json({ error: "Token not found" }, { status: 404 });

  await prisma.fCMToken.update({
    where: { userId_token: { userId, token } },
    data: { isActive: false },
  });

  return NextResponse.json({ data: { token } });
}
