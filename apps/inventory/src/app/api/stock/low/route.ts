import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/stock/low — products at or below reorder level
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const warehouseId = url.searchParams.get("warehouseId") ?? undefined;

  // Get all stock with their product reorder levels
  const allStocks = await prisma.warehouseStock.findMany({
    where: {
      product: { tenantId },
      ...(warehouseId && { warehouseId }),
    },
    include: {
      product: { select: { id: true, sku: true, name: true, reorderLevel: true } },
      warehouse: { select: { id: true, name: true } },
    },
  });

  // Filter to items at or below reorder level
  const lowStock = allStocks.filter((s) => s.quantity <= s.product.reorderLevel);

  const total = lowStock.length;
  const paginated = lowStock.slice(skip, skip + limit);

  return NextResponse.json({ data: paginated, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}
