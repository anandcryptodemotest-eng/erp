import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/stock-locations/:id/track?limit=50 — recent GPS breadcrumbs for a cart,
 * latest first, plus its last-known position (P6/G5).
 */
export async function GET(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));

  const location = await prisma.stockLocation.findFirst({
    where: { id, tenantId },
    select: { id: true, code: true, name: true, lastLatitude: true, lastLongitude: true, lastSeenAt: true },
  });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const pings = await prisma.cartLocationPing.findMany({
    where: { tenantId, stockLocationId: id },
    orderBy: { capturedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    data: {
      location,
      current:
        location.lastLatitude != null && location.lastLongitude != null
          ? { latitude: location.lastLatitude, longitude: location.lastLongitude, at: location.lastSeenAt }
          : null,
      pings,
    },
  });
}
