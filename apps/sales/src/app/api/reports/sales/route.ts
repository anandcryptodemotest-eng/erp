import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const reportQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

const MAX_REPORT_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;
const MAX_ORDER_ROWS = 10_000;

// GET /api/reports/sales
// Query params: from, to (ISO dates), groupBy=day|week|month (default day)
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const query = reportQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!query.success) return NextResponse.json({ error: query.error.errors[0].message }, { status: 400 });

  const from = query.data.from ? new Date(query.data.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = query.data.to ? new Date(query.data.to) : new Date();
  if (from > to) return NextResponse.json({ error: "from must be before to" }, { status: 400 });
  if (to.getTime() - from.getTime() > MAX_REPORT_WINDOW_MS) {
    return NextResponse.json({ error: "Report range cannot exceed 366 days" }, { status: 400 });
  }

  // Totals summary
  const [summary, topCustomers, ordersByStatus] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: { tenantId, date: { gte: from, lte: to }, status: { notIn: ["CANCELLED"] } },
      _sum: { total: true, subtotal: true, tax: true, deliveryFee: true },
      _count: { id: true },
      _avg: { total: true },
    }),
    prisma.salesOrder.groupBy({
      by: ["customerId"],
      where: { tenantId, date: { gte: from, lte: to }, status: { notIn: ["CANCELLED"] } },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
    }),
    prisma.salesOrder.groupBy({
      by: ["status"],
      where: { tenantId, date: { gte: from, lte: to } },
      _count: { id: true },
    }),
  ]);

  // Top selling products by order line quantity
  const topProducts = await prisma.salesOrderItem.groupBy({
    by: ["productId"],
    where: {
      order: { tenantId, date: { gte: from, lte: to }, status: { notIn: ["CANCELLED"] } },
    },
    _sum: { quantity: true, total: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 10,
  });

  // Daily revenue breakdown
  const dailyOrders = await prisma.salesOrder.findMany({
    where: { tenantId, date: { gte: from, lte: to }, status: { notIn: ["CANCELLED"] } },
    select: { date: true, total: true },
    orderBy: { date: "asc" },
    take: MAX_ORDER_ROWS + 1,
  });
  if (dailyOrders.length > MAX_ORDER_ROWS) {
    return NextResponse.json({ error: "Report contains too many orders; narrow the date range" }, { status: 400 });
  }

  // Group by date string
  const dailyMap: Record<string, { date: string; orders: number; revenue: number }> = {};
  for (const o of dailyOrders) {
    const key = o.date.toISOString().split("T")[0];
    if (!dailyMap[key]) dailyMap[key] = { date: key, orders: 0, revenue: 0 };
    dailyMap[key].orders += 1;
    dailyMap[key].revenue += o.total;
  }

  return NextResponse.json({
    data: {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalOrders: summary._count.id,
        revenue: summary._sum.total ?? 0,
        subtotal: summary._sum.subtotal ?? 0,
        tax: summary._sum.tax ?? 0,
        deliveryFees: summary._sum.deliveryFee ?? 0,
        averageOrderValue: summary._avg.total ?? 0,
      },
      ordersByStatus,
      topProducts,
      topCustomers,
      daily: Object.values(dailyMap),
    },
  });
}
