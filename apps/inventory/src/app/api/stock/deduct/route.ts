import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  assertVariantStockScope,
  findWarehouseStock,
  normalizeVariantId,
  upsertStockDelta,
} from "@/lib/warehouse-stock";

const deductSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        warehouseId: z.string(),
        variantId: z.string().optional(),
        quantity: z.number().positive(),
      })
    )
    .min(1),
  reference: z.string().min(1),
  notes: z.string().optional(),
});

// POST /api/stock/deduct — deduct stock and release reservation on shipment
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const { items, reference, notes } = deductSchema.parse(body);

    for (const item of items) {
      const scope = await assertVariantStockScope(prisma, {
        tenantId,
        productId: item.productId,
        variantId: item.variantId,
      });
      if (!scope.ok) {
        return NextResponse.json({ error: scope.error }, { status: scope.status });
      }
    }

    const movements = await prisma.$transaction(async (tx) => {
      const ms = [];
      for (const item of items) {
        const variantId = normalizeVariantId(item.variantId);

        await tx.stockReservation.updateMany({
          where: {
            tenantId,
            reference,
            productId: item.productId,
            warehouseId: item.warehouseId,
            variantId,
            isReleased: false,
          },
          data: { isReleased: true },
        });

        const current = await findWarehouseStock(tx, {
          tenantId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          variantId,
        });
        if (!current || current.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.productId}`);
        }

        await upsertStockDelta(tx, {
          tenantId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          variantId,
          quantityDelta: -item.quantity,
        });

        const m = await tx.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            warehouseId: item.warehouseId,
            variantId,
            type: "OUT",
            quantity: item.quantity,
            reference,
            notes,
          },
        });
        ms.push(m);
      }
      return ms;
    });

    return NextResponse.json({ data: movements }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Insufficient stock")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
