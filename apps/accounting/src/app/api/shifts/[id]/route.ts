import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const closeSchema = z.object({
  closingBalance: z.number().nonnegative(),
  notes: z.string().optional(),
});

// GET /api/shifts/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const shift = await prisma.cashShift.findFirst({
    where: { id, tenantId },
    include: {
      entries: { orderBy: { createdAt: "asc" } },
      _count: { select: { bills: true } },
    },
  });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  return NextResponse.json({ data: shift });
}

// PATCH /api/shifts/:id — close shift
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ error: "Shift is already closed" }, { status: 409 });
  }
  // Only the cashier or an admin/manager can close a shift
  if (shift.cashierId !== userId && !["ADMIN", "MANAGER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = closeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Calculate expected balance: opening + cash_in entries - cash_out entries + bill payments
  const entries = await prisma.cashShiftEntry.findMany({ where: { shiftId: id } });
  const expectedBalance = entries.reduce((sum, e) => {
    if (["CASH_IN", "BILL_PAYMENT"].includes(e.type)) return sum + e.amount;
    if (["CASH_OUT", "REFUND"].includes(e.type)) return sum - e.amount;
    return sum;
  }, shift.openingBalance);

  const difference = parsed.data.closingBalance - expectedBalance;

  const updated = await prisma.cashShift.update({
    where: { id },
    data: {
      status: "CLOSED",
      closingBalance: parsed.data.closingBalance,
      expectedBalance,
      difference,
      closedAt: new Date(),
      notes: parsed.data.notes ?? shift.notes,
    },
  });

  return NextResponse.json({ data: updated });
}
