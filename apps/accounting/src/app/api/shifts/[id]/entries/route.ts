import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createEntrySchema = z.object({
  type: z.enum(["CASH_IN", "CASH_OUT"]),
  amount: z.number().positive(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/shifts/:id/entries
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const shift = await prisma.cashShift.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  const entries = await prisma.cashShiftEntry.findMany({
    where: { shiftId: id, tenantId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ data: entries });
}

// POST /api/shifts/:id/entries — record manual cash in/out
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const { id } = await params;
  const shift = await prisma.cashShift.findFirst({ where: { id, tenantId } });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (shift.status === "CLOSED") {
    return NextResponse.json({ error: "Cannot add entries to a closed shift" }, { status: 409 });
  }
  // Only cashier or admin/manager
  if (shift.cashierId !== userId && !["ADMIN", "MANAGER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const entry = await prisma.cashShiftEntry.create({
    data: { tenantId, shiftId: id, ...parsed.data },
  });
  return NextResponse.json({ data: entry }, { status: 201 });
}
