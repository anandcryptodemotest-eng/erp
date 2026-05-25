import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const transferSchema = z.object({
  productId: z.string(),
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  quantity: z.number().int().positive(),
  variantId: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/stock/transfer — move stock between warehouses
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = transferSchema.parse(body);

    if (data.fromWarehouseId === data.toWarehouseId) {
      return NextResponse.json({ error: "Source and destination warehouse must differ" }, { status: 400 });
    }

    const product = await prisma.product.findFirst({ where: { id: data.productId, tenantId } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const fromStock = await prisma.warehouseStock.findUnique({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.fromWarehouseId } },
    });
    if (!fromStock || fromStock.quantity < data.quantity) {
      return NextResponse.json({ error: "Insufficient stock in source warehouse" }, { status: 409 });
    }

    const reference = `TRANSFER-${Date.now()}`;
    await prisma.$transaction([
      prisma.warehouseStock.update({
        where: { productId_warehouseId: { productId: data.productId, warehouseId: data.fromWarehouseId } },
        data: { quantity: { decrement: data.quantity } },
      }),
      prisma.warehouseStock.upsert({
        where: { productId_warehouseId: { productId: data.productId, warehouseId: data.toWarehouseId } },
        update: { quantity: { increment: data.quantity } },
        create: { productId: data.productId, warehouseId: data.toWarehouseId, quantity: data.quantity },
      }),
      prisma.stockMovement.create({
        data: { tenantId, productId: data.productId, warehouseId: data.fromWarehouseId, variantId: data.variantId, type: "OUT", quantity: data.quantity, reference, notes: data.notes },
      }),
      prisma.stockMovement.create({
        data: { tenantId, productId: data.productId, warehouseId: data.toWarehouseId, variantId: data.variantId, type: "IN", quantity: data.quantity, reference, notes: data.notes },
      }),
    ]);

    return NextResponse.json({ data: { reference, quantity: data.quantity } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
