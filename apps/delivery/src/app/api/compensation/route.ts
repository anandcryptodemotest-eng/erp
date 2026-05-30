import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  baseFee: z.number().min(0).default(0),
  perKmRate: z.number().min(0).default(0),
  bonusPerOrder: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const config = await prisma.deliveryCompensationConfig.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: config ?? null });
}

export async function PUT(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Deactivate existing and create new (immutable config history)
  await prisma.deliveryCompensationConfig.updateMany({
    where: { tenantId, isActive: true },
    data: { isActive: false },
  });

  const config = await prisma.deliveryCompensationConfig.create({
    data: { tenantId, ...parsed.data },
  });

  return NextResponse.json({ data: config });
}
