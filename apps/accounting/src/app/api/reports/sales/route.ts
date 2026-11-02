import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reports/sales — per-location (cart) sales + cash/UPI reconciliation.
 *
 * Query: stockLocationId | warehouseId (one is expected), optional shiftId,
 *        optional from/to ISO dates.
 *
 * Returns units sold, gross revenue, a per-tender (CASH/UPI/CARD/…) breakdown, and
 * nets out CANCELLED/REFUNDED bills so management sees what a cart actually took and
 * what cash is owed. (G3 + G9.)
 */
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const stockLocationId = url.searchParams.get("stockLocationId") ?? undefined;
  const warehouseId = url.searchParams.get("warehouseId") ?? undefined;
  const shiftId = url.searchParams.get("shiftId") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  if (!stockLocationId && !warehouseId && !shiftId) {
    return NextResponse.json({ error: "stockLocationId, warehouseId, or shiftId is required" }, { status: 400 });
  }

  const where = {
    tenantId,
    ...(stockLocationId && { stockLocationId }),
    ...(warehouseId && { warehouseId }),
    ...(shiftId && { shiftId }),
    ...(from || to
      ? { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }
      : {}),
  };

  const bills = await prisma.bill.findMany({
    where,
    select: {
      id: true,
      billNumber: true,
      total: true,
      paymentMethod: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
      items: { select: { quantity: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // A COMPLETED bill is live revenue unless cancelled/refunded. HELD bills (e.g. an
  // offline-sync stock conflict parked for the operator) are neither live nor a
  // reversal — exclude them entirely from the tender math.
  const isReversed = (b: { status: string; paymentStatus: string }) =>
    b.status === "CANCELLED" || b.paymentStatus === "CANCELLED" || b.paymentStatus === "REFUNDED";
  const isHeld = (b: { status: string; paymentStatus: string }) =>
    b.status === "HELD" || b.paymentStatus === "HELD";

  const tenders: Record<string, { grossSales: number; refunds: number; net: number; billCount: number }> = {};
  let grossRevenue = 0;
  let refundedTotal = 0;
  let unitsSold = 0;
  let liveBillCount = 0;
  let reversedBillCount = 0;

  for (const b of bills) {
    if (isHeld(b)) continue; // parked / unfulfilled — not part of sales reconciliation
    const tender = b.paymentMethod || "CASH";
    tenders[tender] ??= { grossSales: 0, refunds: 0, net: 0, billCount: 0 };
    // Every COMPLETED (now or originally) bill contributes its gross to the tender.
    // A reversed bill additionally books a matching refund, so its NET nets to zero
    // rather than going negative (gross 300 − refund 300 = 0).
    tenders[tender].grossSales += b.total;
    grossRevenue += b.total;
    if (isReversed(b)) {
      tenders[tender].refunds += b.total;
      refundedTotal += b.total;
      reversedBillCount += 1;
    } else {
      tenders[tender].billCount += 1;
      unitsSold += b.items.reduce((s, i) => s + i.quantity, 0);
      liveBillCount += 1;
    }
    tenders[tender].net = tenders[tender].grossSales - tenders[tender].refunds;
  }

  const netRevenue = grossRevenue - refundedTotal;

  return NextResponse.json({
    data: {
      scope: { stockLocationId, warehouseId, shiftId, from, to },
      summary: {
        liveBillCount,
        reversedBillCount,
        unitsSold,
        grossRevenue,
        refundedTotal,
        netRevenue,
      },
      // Per-tender reconciliation: expected net take per payment type.
      tenders: Object.entries(tenders).map(([tender, v]) => ({ tender, ...v })),
    },
  });
}
