import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reports/stock
// Query params: warehouseId (optional), lowStockThreshold (default 10)
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const warehouseId = url.searchParams.get("warehouseId") ?? undefined;
  const threshold = Math.max(1, parseInt(url.searchParams.get("lowStockThreshold") ?? "10"));

  const where = {
    tenantId,
    ...(warehouseId && { warehouseId }),
    product: { isActive: true },
  };

  // All stock entries with product info
  const stockEntries = await prisma.warehouseStock.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, sku: true, costPrice: true, sellingPrice: true } },
      warehouse: { select: { id: true, name: true } },
    },
  });

  // Aggregate totals
  let totalStockValue = 0;
  let totalRetailValue = 0;
  let totalUnits = 0;
  const lowStockItems: typeof stockEntries = [];

  for (const entry of stockEntries) {
    const available = entry.quantity - entry.reservedQty;
    totalUnits += available;
    totalStockValue += available * (entry.product.costPrice ?? 0);
    totalRetailValue += available * (entry.product.sellingPrice ?? 0);
    if (available <= threshold) lowStockItems.push(entry);
  }

  // Top products by stock value
  const byValue = [...stockEntries]
    .sort((a, b) => {
      const aVal = (a.quantity - a.reservedQty) * (a.product.costPrice ?? 0);
      const bVal = (b.quantity - b.reservedQty) * (b.product.costPrice ?? 0);
      return bVal - aVal;
    })
    .slice(0, 10)
    .map((e) => ({
      productId: e.productId,
      productName: e.product.name,
      sku: e.product.sku,
      warehouse: e.warehouse.name,
      quantity: e.quantity,
      reservedQty: e.reservedQty,
      availableQty: e.quantity - e.reservedQty,
      stockValue: (e.quantity - e.reservedQty) * (e.product.costPrice ?? 0),
    }));

  // Recent movements (last 100)
  const recentMovements = await prisma.stockMovement.findMany({
    where: { tenantId, ...(warehouseId && { warehouseId }) },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, type: true, quantity: true, reference: true, createdAt: true,
      product: { select: { id: true, name: true, sku: true } },
      warehouse: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    data: {
      summary: {
        totalProducts: stockEntries.length,
        totalUnits,
        totalStockValue,
        totalRetailValue,
        lowStockCount: lowStockItems.length,
        threshold,
      },
      lowStockItems: lowStockItems.map((e) => ({
        productId: e.productId,
        productName: e.product.name,
        sku: e.product.sku,
        warehouse: e.warehouse.name,
        quantity: e.quantity,
        reservedQty: e.reservedQty,
        availableQty: e.quantity - e.reservedQty,
      })),
      topByValue: byValue,
      recentMovements,
    },
  });
}
