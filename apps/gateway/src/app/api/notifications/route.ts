import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/notifications — list in-app notifications for the current user
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const unreadOnly = url.searchParams.get("unread") === "true";

  const where = {
    userId,
    tenantId,
    ...(unreadOnly && { isRead: false }),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, tenantId, isRead: false } }),
  ]);

  return NextResponse.json({
    data: notifications,
    meta: { page, limit, total, pages: Math.ceil(total / limit), unreadCount },
  });
}

// PATCH /api/notifications — mark all as read for the current user
export async function PATCH(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const { count } = await prisma.notification.updateMany({
    where: { userId, tenantId, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ data: { marked: count } });
}
