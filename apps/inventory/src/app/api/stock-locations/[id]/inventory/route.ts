import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/stock-locations/:id/inventory — live per-location stock.
 *
 * Resolves the backing warehouse and returns its on-hand pools + open perishable
 * lots (FEFO order) so a cart's current inventory + expiry picture is one call.
 */
export async function GET(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const location = await prisma.stockLocation.findFirst({
    where: { id, tenantId },
    select: { id: true, code: true, name: true, type: true, status: true, warehouseId: true },
  });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const stocks = await prisma.warehouseStock.findMany({
    where: { tenantId, warehouseId: location.warehouseId, product: { isActive: true } },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true, baseUom: true, sellingUom: true, sellPrice: true, trackBatches: true } },
      variant: { select: { id: true, sku: true, name: true, sellPrice: true } },
    },
  });

  const lots = await prisma.stockBatch.findMany({
    where: { tenantId, warehouseId: location.warehouseId, isExpired: false, quantity: { gt: 0 } },
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { receivedDate: "asc" }],
    select: { id: true, productId: true, variantId: true, batchNo: true, quantity: true, expiryDate: true },
  });

  const now = Date.now();
  const items = stocks.map((s) => {
    const available = s.quantity - s.reservedQty;
    const sell = s.variant?.sellPrice ?? s.product.sellPrice ?? 0;
    return {
      productId: s.productId,
      variantId: s.variantId,
      productName: s.variant ? `${s.product.name} / ${s.variant.name}` : s.product.name,
      sku: s.variant?.sku ?? s.product.sku,
      unit: s.product.unit,
      baseUom: s.product.baseUom,
      sellingUom: s.product.sellingUom,
      onHand: s.quantity,
      reserved: s.reservedQty,
      available,
      retailValue: available * sell,
      trackBatches: s.product.trackBatches,
      lots: lots
        .filter((b) => b.productId === s.productId && b.variantId === s.variantId)
        .map((b) => ({
          batchNo: b.batchNo,
          quantity: b.quantity,
          expiryDate: b.expiryDate,
          daysToExpiry: b.expiryDate != null ? Math.floor((new Date(b.expiryDate).getTime() - now) / 86_400_000) : null,
        })),
    };
  });

  const totalUnits = items.reduce((s, i) => s + i.available, 0);
  const totalRetailValue = items.reduce((s, i) => s + i.retailValue, 0);

  return NextResponse.json({
    data: {
      location,
      summary: { skuCount: items.length, totalUnits, totalRetailValue },
      items,
    },
  });
}
