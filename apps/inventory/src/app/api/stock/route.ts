import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const stockMovementSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  variantId: z.string().optional(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.number().int().positive(),
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

  const where = {
    product: { tenantId },
    ...(warehouseId && { warehouseId }),
  };

  const [stocks, total] = await Promise.all([
    prisma.warehouseStock.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true, reorderLevel: true } },
        warehouse: { select: { id: true, name: true } },
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

    // Verify product belongs to tenant
    const product = await prisma.product.findFirst({ where: { id: data.productId, tenantId } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const warehouse = await prisma.warehouse.findFirst({ where: { id: data.warehouseId, tenantId } });
    if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

    const quantityDelta = data.type === "OUT" ? -data.quantity : data.quantity;

    const movement = await prisma.$transaction(async (tx) => {
      const m = await tx.stockMovement.create({ data: { ...data, tenantId } });
      await tx.warehouseStock.upsert({
        where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
        update: { quantity: { increment: quantityDelta } },
        create: { productId: data.productId, warehouseId: data.warehouseId, quantity: quantityDelta },
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

