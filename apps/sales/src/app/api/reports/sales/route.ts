import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reports/sales
// Query params: from, to (ISO dates), groupBy=day|week|month (default day)
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = toParam ? new Date(toParam) : new Date();

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
  });

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
