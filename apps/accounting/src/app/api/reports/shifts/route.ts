import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reports/shifts
// Query params: from, to (ISO dates), cashierId (optional)
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const cashierId = url.searchParams.get("cashierId") ?? undefined;
  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = toParam ? new Date(toParam) : new Date();

  const shifts = await prisma.cashShift.findMany({
    where: {
      tenantId,
      openedAt: { gte: from, lte: to },
      ...(cashierId && { cashierId }),
    },
    include: {
      _count: { select: { bills: true, entries: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  // Aggregate shift totals
  const [billAgg, entryAgg] = await Promise.all([
    prisma.bill.groupBy({
      by: ["shiftId", "status"],
      where: { tenantId, shiftId: { in: shifts.map((s) => s.id) } },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.cashShiftEntry.groupBy({
      by: ["shiftId", "type"],
      where: { tenantId, shiftId: { in: shifts.map((s) => s.id) } },
      _sum: { amount: true },
    }),
  ]);

  // Per-shift summary
  const shiftSummaries = shifts.map((shift) => {
    const shiftBills = billAgg.filter((b) => b.shiftId === shift.id);
    const shiftEntries = entryAgg.filter((e) => e.shiftId === shift.id);
    const completedBillTotal = shiftBills
      .filter((b) => b.status === "COMPLETED")
      .reduce((s, b) => s + (b._sum.total ?? 0), 0);
    const cashIn = shiftEntries
      .filter((e) => e.type === "CASH_IN")
      .reduce((s, e) => s + (e._sum.amount ?? 0), 0);
    const cashOut = shiftEntries
      .filter((e) => e.type === "CASH_OUT")
      .reduce((s, e) => s + (e._sum.amount ?? 0), 0);
    const refunds = shiftEntries
      .filter((e) => e.type === "REFUND")
      .reduce((s, e) => s + (e._sum.amount ?? 0), 0);

    return {
      id: shift.id,
      cashierId: shift.cashierId,
      status: shift.status,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openingBalance: shift.openingBalance,
      closingBalance: shift.closingBalance,
      expectedBalance: shift.expectedBalance,
      difference: shift.difference,
      billCount: shift._count.bills,
      completedBillTotal,
      cashIn,
      cashOut,
      refunds,
      netCash: shift.openingBalance + completedBillTotal + cashIn - cashOut - refunds,
    };
  });

  // Overall summary
  const totalRevenue = shiftSummaries.reduce((s, sh) => s + sh.completedBillTotal, 0);
  const totalBills = shiftSummaries.reduce((s, sh) => s + sh.billCount, 0);
  const totalDifference = shiftSummaries
    .filter((sh) => sh.difference !== null)
    .reduce((s, sh) => s + (sh.difference ?? 0), 0);

  return NextResponse.json({
    data: {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalShifts: shifts.length,
        openShifts: shifts.filter((s) => s.status === "OPEN").length,
        totalRevenue,
        totalBills,
        totalDifference,
      },
      shifts: shiftSummaries,
    },
  });
}
