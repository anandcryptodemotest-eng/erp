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

  const stockEntries = await prisma.warehouseStock.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          costPrice: true,
          sellPrice: true,
          productStructure: true,
        },
      },
      warehouse: { select: { id: true, name: true } },
      variant: { select: { id: true, sku: true, name: true, costPrice: true, sellPrice: true } },
    },
  });

  let totalStockValue = 0;
  let totalRetailValue = 0;
  let totalUnits = 0;
  const lowStockItems: typeof stockEntries = [];

  for (const entry of stockEntries) {
    const available = entry.quantity - entry.reservedQty;
    const unitCost = entry.variant?.costPrice ?? entry.product.costPrice ?? 0;
    const unitSell = entry.variant?.sellPrice ?? entry.product.sellPrice ?? 0;
    totalUnits += available;
    totalStockValue += available * unitCost;
    totalRetailValue += available * unitSell;
    if (available <= threshold) lowStockItems.push(entry);
  }

  const byValue = [...stockEntries]
    .sort((a, b) => {
      const aCost = a.variant?.costPrice ?? a.product.costPrice ?? 0;
      const bCost = b.variant?.costPrice ?? b.product.costPrice ?? 0;
      const aVal = (a.quantity - a.reservedQty) * aCost;
      const bVal = (b.quantity - b.reservedQty) * bCost;
      return bVal - aVal;
    })
    .slice(0, 10)
    .map((e) => {
      const unitCost = e.variant?.costPrice ?? e.product.costPrice ?? 0;
      return {
        productId: e.productId,
        variantId: e.variantId,
        productName: e.variant ? `${e.product.name} / ${e.variant.name}` : e.product.name,
        sku: e.variant?.sku ?? e.product.sku,
        warehouse: e.warehouse.name,
        quantity: e.quantity,
        reservedQty: e.reservedQty,
        availableQty: e.quantity - e.reservedQty,
        stockValue: (e.quantity - e.reservedQty) * unitCost,
      };
    });

  const recentMovements = await prisma.stockMovement.findMany({
    where: { tenantId, ...(warehouseId && { warehouseId }) },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      quantity: true,
      reference: true,
      createdAt: true,
      variantId: true,
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
        variantId: e.variantId,
        productName: e.variant ? `${e.product.name} / ${e.variant.name}` : e.product.name,
        sku: e.variant?.sku ?? e.product.sku,
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
