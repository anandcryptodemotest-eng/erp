import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  pincode: z.string().min(1),
});

// POST /api/zones/check-pincode
// Used by the customer app at checkout to verify delivery availability.
export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { pincode } = parsed.data;

  // Find an active zone that includes this pincode
  const zones = await prisma.deliveryZone.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      pincodes: true,
      deliveryFee: true,
      minOrderAmount: true,
      estimatedMins: true,
    },
  });

  const matched = zones.find((zone) => {
    const list = zone.pincodes as string[];
    return list.includes(pincode);
  });

  if (!matched) {
    return NextResponse.json(
      { error: "Delivery is not available to your area" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      zoneId: matched.id,
      zoneName: matched.name,
      deliveryFee: matched.deliveryFee,
      minOrderAmount: matched.minOrderAmount,
      estimatedMins: matched.estimatedMins,
    },
  });
}
