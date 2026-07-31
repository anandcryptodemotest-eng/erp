import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  assertVariantStockScope,
  normalizeVariantId,
  upsertStockDelta,
} from "@/lib/warehouse-stock";

const stockMovementSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  variantId: z.string().optional(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.number().positive(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/stock — paginated stock levels
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const warehouseId = url.searchParams.get("warehouseId") ?? undefined;
  const productId = url.searchParams.get("productId") ?? undefined;
  const variantId = url.searchParams.get("variantId") ?? undefined;

  const where = {
    tenantId,
    ...(warehouseId && { warehouseId }),
    ...(productId && { productId }),
    ...(variantId !== undefined && { variantId: variantId || null }),
  };

  const [stocks, total] = await Promise.all([
    prisma.warehouseStock.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            reorderLevel: true,
            productStructure: true,
            costPrice: true,
          },
        },
        warehouse: { select: { id: true, name: true } },
        variant: { select: { id: true, sku: true, name: true, costPrice: true } },
      },
      orderBy: { product: { name: "asc" } },
      skip,
      take: limit,
    }),
    prisma.warehouseStock.count({ where }),
  ]);

  return NextResponse.json({ data: stocks, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/stock — record a manual stock movement (IN/OUT/ADJUSTMENT)
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = stockMovementSchema.parse(body);
    const variantId = normalizeVariantId(data.variantId);

    const scope = await assertVariantStockScope(prisma, {
      tenantId,
      productId: data.productId,
      variantId,
    });
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: data.warehouseId, tenantId },
    });
    if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

    const quantityDelta = data.type === "OUT" ? -data.quantity : data.quantity;

    const movement = await prisma.$transaction(async (tx) => {
      const m = await tx.stockMovement.create({
        data: {
          tenantId,
          productId: data.productId,
          warehouseId: data.warehouseId,
          variantId,
          type: data.type,
          quantity: data.quantity,
          reference: data.reference,
          notes: data.notes,
        },
      });
      await upsertStockDelta(tx, {
        tenantId,
        productId: data.productId,
        warehouseId: data.warehouseId,
        variantId,
        quantityDelta,
      });
      return m;
    });

    return NextResponse.json({ data: movement }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
