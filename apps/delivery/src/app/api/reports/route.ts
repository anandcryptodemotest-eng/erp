import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reports
// Query params: from, to (ISO dates), executiveId (optional)
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const executiveId = url.searchParams.get("executiveId") ?? undefined;
  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = toParam ? new Date(toParam) : new Date();

  const assignmentWhere = {
    tenantId,
    assignedAt: { gte: from, lte: to },
    ...(executiveId && { executiveId }),
  };

  const [byStatus, topExecutives, earnings] = await Promise.all([
    // Assignment count by status
    prisma.deliveryAssignment.groupBy({
      by: ["status"],
      where: assignmentWhere,
      _count: { id: true },
    }),
    // Top executives by deliveries completed
    prisma.deliveryAssignment.groupBy({
      by: ["executiveId"],
      where: { ...assignmentWhere, status: "DELIVERED" },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    // Earnings summary
    prisma.deliveryEarningLog.aggregate({
      where: {
        tenantId,
        ...(executiveId && { executiveId }),
      },
      _sum: { total: true, baseFee: true, bonus: true },
      _count: { id: true },
    }),
  ]);

  // Average delivery time (PICKED_UP → DELIVERED)
  const delivered = await prisma.deliveryAssignment.findMany({
    where: { ...assignmentWhere, status: "DELIVERED", pickedUpAt: { not: null }, deliveredAt: { not: null } },
    select: { pickedUpAt: true, deliveredAt: true },
  });

  let avgDeliveryMinutes = 0;
  if (delivered.length > 0) {
    const totalMs = delivered.reduce((sum, d) => {
      return sum + (d.deliveredAt!.getTime() - d.pickedUpAt!.getTime());
    }, 0);
    avgDeliveryMinutes = Math.round(totalMs / delivered.length / 60000);
  }

  const totalAssignments = byStatus.reduce((s, b) => s + b._count.id, 0);
  const deliveredCount = byStatus.find((b) => b.status === "DELIVERED")?._count.id ?? 0;
  const failedCount = byStatus.find((b) => b.status === "FAILED")?._count.id ?? 0;

  // Unpaid earnings by executive
  const unpaidEarnings = await prisma.deliveryEarningLog.groupBy({
    by: ["executiveId"],
    where: { tenantId, isPaid: false, ...(executiveId && { executiveId }) },
    _sum: { total: true },
  });

  return NextResponse.json({
    data: {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalAssignments,
        deliveredCount,
        failedCount,
        successRate: totalAssignments > 0 ? Math.round((deliveredCount / totalAssignments) * 100) : 0,
        avgDeliveryMinutes,
        totalEarnings: earnings._sum.total ?? 0,
        totalBaseFee: earnings._sum.baseFee ?? 0,
        totalBonus: earnings._sum.bonus ?? 0,
      },
      byStatus,
      topExecutives,
      unpaidEarnings,
    },
  });
}
