import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const openSchema = z.object({
  openingBalance: z.number().nonnegative(),
  notes: z.string().optional(),
});

// GET /api/shifts
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const status = url.searchParams.get("status") ?? undefined;
  const cashierId = url.searchParams.get("cashierId") ?? undefined;

  const where = {
    tenantId,
    ...(status && { status }),
    ...(cashierId && { cashierId }),
  };

  const [shifts, total] = await Promise.all([
    prisma.cashShift.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip,
      take: limit,
      include: { _count: { select: { bills: true, entries: true } } },
    }),
    prisma.cashShift.count({ where }),
  ]);

  return NextResponse.json({ data: shifts, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/shifts — open a new shift
export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  // Prevent double-opening
  const openShift = await prisma.cashShift.findFirst({
    where: { tenantId, cashierId: userId, status: "OPEN" },
  });
  if (openShift) {
    return NextResponse.json({ error: "Cashier already has an open shift" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = openSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const shift = await prisma.cashShift.create({
    data: {
      tenantId,
      cashierId: userId,
      openingBalance: parsed.data.openingBalance,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json({ data: shift }, { status: 201 });
}
