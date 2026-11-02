import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  assertVariantStockScope,
  atomicDecrementStock,
  normalizeVariantId,
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
  /**
   * Optional caller-supplied key making the deduction idempotent: a retried POST
   * with the same key returns the original movements instead of deducting twice.
   * Movements are tagged `<key>:<index>` (mirrors stock/receive).
   */
  idempotencyKey: z.string().min(1).optional(),
  notes: z.string().optional(),
});

class InsufficientStockError extends Error {
  constructor(productId: string) {
    super(`Insufficient stock for product ${productId}`);
    this.name = "InsufficientStockError";
  }
}

// POST /api/stock/deduct — deduct stock and release reservation on shipment
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  let parsedIdempotencyKey: string | undefined;
  try {
    const body = await request.json();
    const { items, reference, idempotencyKey, notes } = deductSchema.parse(body);
    parsedIdempotencyKey = idempotencyKey;

    // Idempotency: a retried deduct with the same key is a no-op — return the
    // movements recorded by the first call rather than deducting again.
    if (idempotencyKey) {
      const existing = await prisma.stockMovement.findMany({
        where: { tenantId, idempotencyKey: { startsWith: `${idempotencyKey}:` } },
      });
      if (existing.length > 0) return NextResponse.json({ data: existing });
    }

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

    let replayed = false;
    const movements = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction to close the window between the pre-check
      // and commit for a retried key.
      if (idempotencyKey) {
        const existing = await tx.stockMovement.findMany({
          where: { tenantId, idempotencyKey: { startsWith: `${idempotencyKey}:` } },
        });
        if (existing.length > 0) {
          replayed = true;
          return existing;
        }
      }

      const ms = [];
      let movementIndex = 0;
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

        // Atomic guarded decrement of the aggregate pool (source of truth for
        // totals). A single conditional UPDATE (quantity >= qty) that concurrent
        // sales cannot both win — prevents oversell / negative stock. On a 0-row
        // match there is not enough on-hand, so we abort the whole deduction.
        const decremented = await atomicDecrementStock(tx, {
          tenantId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          variantId,
          quantity: item.quantity,
        });
        if (!decremented.ok) {
          throw new InsufficientStockError(item.productId);
        }

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
                idempotencyKey: idempotencyKey ? `${idempotencyKey}:${movementIndex++}` : undefined,
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
                idempotencyKey: idempotencyKey ? `${idempotencyKey}:${movementIndex++}` : undefined,
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
              idempotencyKey: idempotencyKey ? `${idempotencyKey}:${movementIndex++}` : undefined,
              notes,
            },
          });
          ms.push(m);
        }
      }
      return ms;
    });

    return NextResponse.json({ data: movements }, { status: replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    // A concurrent retry with the same idempotency key can collide on the unique
    // (tenantId, idempotencyKey) movement index — treat it as the first write winning.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002" &&
      parsedIdempotencyKey
    ) {
      const existing = await prisma.stockMovement.findMany({
        where: { tenantId, idempotencyKey: { startsWith: `${parsedIdempotencyKey}:` } },
      });
      if (existing.length > 0) return NextResponse.json({ data: existing });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
