import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  assertVariantStockScope,
  findWarehouseStock,
  normalizeVariantId,
  upsertStockDelta,
} from "@/lib/warehouse-stock";

const transferSchema = z.object({
  productId: z.string(),
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  quantity: z.number().positive(),
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
    const variantId = normalizeVariantId(data.variantId);

    if (data.fromWarehouseId === data.toWarehouseId) {
      return NextResponse.json({ error: "Source and destination warehouse must differ" }, { status: 400 });
    }

    const scope = await assertVariantStockScope(prisma, {
      tenantId,
      productId: data.productId,
      variantId,
    });
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const fromStock = await findWarehouseStock(prisma, {
      tenantId,
      productId: data.productId,
      warehouseId: data.fromWarehouseId,
      variantId,
    });
    if (!fromStock || fromStock.quantity < data.quantity) {
      return NextResponse.json({ error: "Insufficient stock in source warehouse" }, { status: 409 });
    }

    const reference = `TRANSFER-${Date.now()}`;
    await prisma.$transaction(async (tx) => {
      await upsertStockDelta(tx, {
        tenantId,
        productId: data.productId,
        warehouseId: data.fromWarehouseId,
        variantId,
        quantityDelta: -data.quantity,
      });
      await upsertStockDelta(tx, {
        tenantId,
        productId: data.productId,
        warehouseId: data.toWarehouseId,
        variantId,
        quantityDelta: data.quantity,
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: data.productId,
          warehouseId: data.fromWarehouseId,
          variantId,
          type: "OUT",
          quantity: data.quantity,
          reference,
          notes: data.notes,
        },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: data.productId,
          warehouseId: data.toWarehouseId,
          variantId,
          type: "IN",
          quantity: data.quantity,
          reference,
          notes: data.notes,
        },
      });
    });

    return NextResponse.json({ data: { reference, quantity: data.quantity } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
