import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const pingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
});

/**
 * POST /api/stock-locations/:id/ping — record a GPS breadcrumb for a roaming cart
 * and update its last-known position (P6/G5).
 */
export async function POST(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  try {
    const data = pingSchema.parse(await request.json());
    const location = await prisma.stockLocation.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

    const ping = await prisma.$transaction(async (tx) => {
      const p = await tx.cartLocationPing.create({
        data: { tenantId, stockLocationId: id, latitude: data.latitude, longitude: data.longitude, accuracy: data.accuracy },
      });
      await tx.stockLocation.update({
        where: { id },
        data: { lastLatitude: data.latitude, lastLongitude: data.longitude, lastSeenAt: p.capturedAt },
      });
      return p;
    });

    return NextResponse.json({ data: ping }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
