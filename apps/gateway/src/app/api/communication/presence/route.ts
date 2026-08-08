import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";

export const runtime = "nodejs";

/**
 * GET /api/communication/presence?userId=xxx
 * Get presence for a user (or all online users in tenant if no userId).
 */
export async function GET(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const tenantId = request.headers.get("x-tenant-id") || auth.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (userId) {
    const presence = await prisma.presence.findUnique({
      where: { userId },
    });
    return NextResponse.json({ data: presence || { userId, status: "OFFLINE", lastSeenAt: null } });
  }

  // All online/away users in tenant
  const presences = await prisma.presence.findMany({
    where: {
      tenantId,
      status: { not: "OFFLINE" },
    },
  });
  return NextResponse.json({ data: presences });
}

/**
 * PUT /api/communication/presence
 * Update current user's presence.
 * Body: { status: "ONLINE" | "AWAY" | "OFFLINE" }
 */
export async function PUT(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const tenantId = request.headers.get("x-tenant-id") || auth.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const body = await request.json();
  const { status } = body;

  if (!status || !["ONLINE", "AWAY", "OFFLINE"].includes(status)) {
    return NextResponse.json({ error: "status must be ONLINE, AWAY, or OFFLINE" }, { status: 400 });
  }

  const presence = await prisma.presence.upsert({
    where: { userId: auth.userId },
    create: {
      userId: auth.userId,
      tenantId,
      status,
      lastSeenAt: status === "OFFLINE" ? new Date() : null,
    },
    update: {
      status,
      lastSeenAt: status === "OFFLINE" ? new Date() : null,
    },
  });

  return NextResponse.json({ data: presence });
}