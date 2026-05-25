import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/stock/movements — paginated movement history
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const productId = url.searchParams.get("productId") ?? undefined;
  const warehouseId = url.searchParams.get("warehouseId") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const reference = url.searchParams.get("reference") ?? undefined;

  const where = {
    tenantId,
    ...(productId && { productId }),
    ...(warehouseId && { warehouseId }),
    ...(type && { type }),
    ...(reference && { reference }),
  };

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return NextResponse.json({ data: movements, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}
