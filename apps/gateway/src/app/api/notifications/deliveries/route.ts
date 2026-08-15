import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

/** GET /api/notifications/deliveries — outbound delivery log (dead-letter visible). */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const tenantId = auth.tenantId!;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const status = url.searchParams.get("status") ?? undefined;
  const channel = url.searchParams.get("channel") ?? undefined;

  const where = {
    tenantId,
    ...(status ? { status } : {}),
    ...(channel ? { channel } : {}),
  };

  const [deliveries, total] = await Promise.all([
    prisma.notificationDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notificationDelivery.count({ where }),
  ]);

  return NextResponse.json({
    data: deliveries,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
