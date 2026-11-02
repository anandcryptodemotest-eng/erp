import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  assertVariantStockScope,
  atomicDecrementStock,
  normalizeVariantId,
  upsertStockDelta,
} from "@/lib/warehouse-stock";
import { consumeFefo, receiveIntoBatch } from "@/lib/stock-batches";

const transferSchema = z.object({
  productId: z.string(),
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  quantity: z.number().positive(),
  variantId: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/stock/transfer — move stock between warehouses.
 *
 * Batch/expiry aware (G2): for perishable (trackBatches) products the transfer
 * consumes the SOURCE lots First-Expired-First-Out and recreates matching lots at
 * the DESTINATION (same batchNo + expiryDate), so a cart restocked from the central
 * warehouse keeps its FEFO/expiry lineage instead of receiving an undated aggregate
 * blob. Non-batch products keep the simple aggregate move.
 *
 * The source aggregate pool is decremented with an atomic guard (quantity >= qty) so
 * concurrent transfers/sales can never oversell. Everything runs in one transaction.
 */
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

    const product = await prisma.product.findFirst({
      where: { id: data.productId, tenantId },
      select: { trackBatches: true },
    });

    const reference = `TRANSFER-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      // Atomic guarded decrement of the source aggregate pool — never oversell.
      const decremented = await atomicDecrementStock(tx, {
        tenantId,
        productId: data.productId,
        warehouseId: data.fromWarehouseId,
        variantId,
        quantity: data.quantity,
      });
      if (!decremented.ok) {
        throw new InsufficientStockError();
      }

      // Increase the destination aggregate pool.
      await upsertStockDelta(tx, {
        tenantId,
        productId: data.productId,
        warehouseId: data.toWarehouseId,
        variantId,
        quantityDelta: data.quantity,
      });

      if (product?.trackBatches) {
        // Move the actual lots FEFO: consume earliest-expiry source lots, and
        // recreate each consumed slice at the destination with the same batchNo +
        // expiry so FEFO/expiry carries over to the cart.
        const consumption = await consumeFefo(tx, {
          tenantId,
          productId: data.productId,
          warehouseId: data.fromWarehouseId,
          variantId,
          quantity: data.quantity,
        });

        for (const lot of consumption) {
          // OUT of the source lot.
          await tx.stockMovement.create({
            data: {
              tenantId,
              productId: data.productId,
              warehouseId: data.fromWarehouseId,
              variantId,
              type: "TRANSFER",
              quantity: lot.quantity,
              batchId: lot.batchId,
              reference,
              notes: data.notes ?? `Transfer out lot ${lot.batchNo}`,
            },
          });

          // Recreate / merge the lot at the destination (same batchNo + expiry).
          const destBatch = await receiveIntoBatch(tx, {
            tenantId,
            productId: data.productId,
            warehouseId: data.toWarehouseId,
            variantId,
            batchNo: lot.batchNo,
            quantity: lot.quantity,
            expiryDate: lot.expiryDate,
          });

          // IN to the destination lot.
          await tx.stockMovement.create({
            data: {
              tenantId,
              productId: data.productId,
              warehouseId: data.toWarehouseId,
              variantId,
              type: "TRANSFER",
              quantity: lot.quantity,
              batchId: destBatch.id,
              reference,
              notes: data.notes ?? `Transfer in lot ${lot.batchNo}`,
            },
          });
        }
      } else {
        // Non-batch product: aggregate move only (paired OUT/IN movements).
        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: data.productId,
            warehouseId: data.fromWarehouseId,
            variantId,
            type: "TRANSFER",
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
            type: "TRANSFER",
            quantity: data.quantity,
            reference,
            notes: data.notes,
          },
        });
      }
    });

    return NextResponse.json({ data: { reference, quantity: data.quantity } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: "Insufficient stock in source warehouse" }, { status: 409 });
    }
    // consumeFefo throws when open lots can't cover the (already-guarded) aggregate —
    // e.g. the aggregate and lot rows drifted. Surface as a conflict, not a 500.
    if (error instanceof Error && /Insufficient batch stock/.test(error.message)) {
      return NextResponse.json({ error: "Insufficient batched stock in source warehouse" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

class InsufficientStockError extends Error {
  constructor() {
    super("Insufficient stock in source warehouse");
    this.name = "InsufficientStockError";
  }
}
