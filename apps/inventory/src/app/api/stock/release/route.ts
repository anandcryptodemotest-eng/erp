import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const releaseSchema = z.object({
  reference: z.string().min(1),
});

// POST /api/stock/release — release all reservations for a reference (order cancel)
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const { reference } = releaseSchema.parse(body);

    const result = await prisma.stockReservation.updateMany({
      where: { tenantId, reference, isReleased: false },
      data: { isReleased: true },
    });

    return NextResponse.json({ data: { released: result.count } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
