import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  assertVariantStockScope,
  findWarehouseStock,
  normalizeVariantId,
  upsertStockDelta,
} from "@/lib/warehouse-stock";
import { consumeFefoAllowingShortfall } from "@/lib/stock-batches";

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

        // Decrement the aggregate pool (source of truth for totals).
        await upsertStockDelta(tx, {
          tenantId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          variantId,
          quantityDelta: -item.quantity,
        });

        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId },
          select: { trackBatches: true },
        });

        if (product?.trackBatches) {
          // FEFO: consume oldest-expiring lots first (one OUT movement per lot for a
          // per-lot traceability trail). The aggregate pool already approved the
          // deduction, so if the open lots fall short (e.g. after a direct adjustment
          // or expiry write-off) we record the uncovered remainder as a single
          // non-lot aggregate OUT rather than failing the whole shipment.
          const { consumption, shortfall } = await consumeFefoAllowingShortfall(tx, {
            tenantId,
            productId: item.productId,
            warehouseId: item.warehouseId,
            variantId,
            quantity: item.quantity,
          });
          for (const part of consumption) {
            const m = await tx.stockMovement.create({
              data: {
                tenantId,
                productId: item.productId,
                warehouseId: item.warehouseId,
                variantId,
                type: "OUT",
                quantity: part.quantity,
                batchId: part.batchId,
                reference,
                notes: notes ?? `FEFO lot ${part.batchNo}`,
              },
            });
            ms.push(m);
          }
          if (shortfall > 0) {
            const m = await tx.stockMovement.create({
              data: {
                tenantId,
                productId: item.productId,
                warehouseId: item.warehouseId,
                variantId,
                type: "OUT",
                quantity: shortfall,
                reference,
                notes: notes ?? "Unbatched remainder (lots short of aggregate)",
              },
            });
            ms.push(m);
          }
        } else {
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
