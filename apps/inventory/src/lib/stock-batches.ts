import type { PrismaClient } from "../generated/prisma";
import { prisma } from "./prisma";
import { normalizeVariantId } from "./warehouse-stock";

/** Prisma client or interactive transaction client */
type Db = PrismaClient | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type BatchScope = {
  tenantId: string;
  productId: string;
  warehouseId: string;
  variantId?: string | null;
};

/** Tiny float tolerance so FEFO treats e.g. 0.30000000001 as depleted. */
const EPSILON = 1e-9;

/**
 * Compute an expiry date from a received date and a product's shelf life (days).
 * Returns null when either input is missing.
 */
export function computeExpiry(receivedDate: Date, shelfLifeDays?: number | null): Date | null {
  if (!shelfLifeDays || shelfLifeDays <= 0) return null;
  const d = new Date(receivedDate);
  d.setDate(d.getDate() + shelfLifeDays);
  return d;
}

/**
 * Receive a quantity into a specific batch (creating it if new) for a perishable product.
 * Increments the batch's remaining + initial quantity. Caller is responsible for also
 * incrementing the aggregate WarehouseStock (via upsertStockDelta) within the same tx.
 */
export async function receiveIntoBatch(
  db: Db,
  args: BatchScope & {
    batchNo?: string | null;
    quantity: number;
    expiryDate?: Date | null;
    receivedDate?: Date | null;
  }
) {
  const variantId = normalizeVariantId(args.variantId);
  const receivedDate = args.receivedDate ?? new Date();
  // Default batch label groups the receipt by expiry (or date) so same-day/same-expiry
  // receipts merge into one lot rather than fragmenting into many rows.
  const batchNo =
    args.batchNo && args.batchNo.trim().length > 0
      ? args.batchNo.trim()
      : `LOT-${(args.expiryDate ?? receivedDate).toISOString().slice(0, 10)}`;

  const existing = await db.stockBatch.findFirst({
    where: {
      tenantId: args.tenantId,
      productId: args.productId,
      warehouseId: args.warehouseId,
      variantId,
      batchNo,
    },
  });

  if (existing) {
    return db.stockBatch.update({
      where: { id: existing.id },
      data: {
        quantity: { increment: args.quantity },
        initialQuantity: { increment: args.quantity },
        // Keep the earliest known expiry if a new one is supplied.
        ...(args.expiryDate && (!existing.expiryDate || args.expiryDate < existing.expiryDate)
          ? { expiryDate: args.expiryDate }
          : {}),
        isExpired: false,
      },
    });
  }

  return db.stockBatch.create({
    data: {
      tenantId: args.tenantId,
      productId: args.productId,
      warehouseId: args.warehouseId,
      variantId,
      batchNo,
      quantity: args.quantity,
      initialQuantity: args.quantity,
      expiryDate: args.expiryDate ?? null,
      receivedDate,
    },
  });
}

export type FefoConsumption = {
  batchId: string;
  batchNo: string;
  quantity: number;
  expiryDate: Date | null;
}[];

/**
 * Consume a quantity across batches First-Expired-First-Out.
 * Batches with an expiry date are consumed before non-dated batches (NULLS LAST),
 * earliest expiry first, then oldest received. Decrements each batch's remaining qty.
 *
 * Returns the per-batch breakdown so the caller can write one StockMovement per batch.
 * Throws when the open batches cannot cover the requested quantity.
 *
 * NOTE: run inside the same transaction that decrements the aggregate WarehouseStock.
 */
export async function consumeFefo(
  db: Db,
  args: BatchScope & { quantity: number }
): Promise<FefoConsumption> {
  const variantId = normalizeVariantId(args.variantId);

  const batches = await db.stockBatch.findMany({
    where: {
      tenantId: args.tenantId,
      productId: args.productId,
      warehouseId: args.warehouseId,
      variantId,
      isExpired: false,
      quantity: { gt: 0 },
    },
    // FEFO: earliest expiry first; non-dated lots last; tie-break by oldest received.
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { receivedDate: "asc" }],
  });

  const totalOpen = batches.reduce((sum, b) => sum + b.quantity, 0);
  if (totalOpen + EPSILON < args.quantity) {
    throw new Error(
      `Insufficient batch stock for product ${args.productId}: open ${totalOpen}, requested ${args.quantity}`
    );
  }

  return consumeBatchesInOrder(db, batches, args.quantity);
}

/**
 * Consume FEFO up to what the open lots can cover and report any uncovered remainder
 * instead of throwing. Use when the aggregate pool (source of truth) already approved
 * the deduction but the lot rows are short (e.g. after direct adjustments or an
 * expiry write-off). The caller records `shortfall` as a non-lot aggregate OUT.
 */
export async function consumeFefoAllowingShortfall(
  db: Db,
  args: BatchScope & { quantity: number }
): Promise<{ consumption: FefoConsumption; shortfall: number }> {
  const variantId = normalizeVariantId(args.variantId);

  const batches = await db.stockBatch.findMany({
    where: {
      tenantId: args.tenantId,
      productId: args.productId,
      warehouseId: args.warehouseId,
      variantId,
      isExpired: false,
      quantity: { gt: 0 },
    },
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { receivedDate: "asc" }],
  });

  const totalOpen = batches.reduce((sum, b) => sum + b.quantity, 0);
  const consumable = Math.min(totalOpen, args.quantity);
  const consumption = await consumeBatchesInOrder(db, batches, consumable);
  const shortfall = Number(Math.max(0, args.quantity - totalOpen).toFixed(6));
  return { consumption, shortfall };
}

/** Decrement a pre-ordered list of batches by `quantity`, returning the per-batch take. */
async function consumeBatchesInOrder(
  db: Db,
  batches: { id: string; batchNo: string; quantity: number; expiryDate: Date | null }[],
  quantity: number
): Promise<FefoConsumption> {
  const consumption: FefoConsumption = [];
  let remaining = quantity;

  for (const batch of batches) {
    if (remaining <= EPSILON) break;
    const take = Math.min(batch.quantity, remaining);
    if (take <= EPSILON) continue;

    const nextQty = Number((batch.quantity - take).toFixed(6));
    await db.stockBatch.update({
      where: { id: batch.id },
      data: { quantity: nextQty < EPSILON ? 0 : nextQty },
    });

    consumption.push({
      batchId: batch.id,
      batchNo: batch.batchNo,
      quantity: Number(take.toFixed(6)),
      expiryDate: batch.expiryDate,
    });
    remaining = Number((remaining - take).toFixed(6));
  }

  return consumption;
}

/**
 * List batches at or past a given date for a tenant (expiry sweep / spoilage report).
 * `within` lets you look ahead (e.g. the next 3 days) for near-expiry markdown.
 */
export async function findExpiringBatches(
  db: Db,
  args: { tenantId: string; asOf?: Date; withinDays?: number; includeExpired?: boolean }
) {
  const asOf = args.asOf ?? new Date();
  const horizon = new Date(asOf);
  if (args.withinDays && args.withinDays > 0) horizon.setDate(horizon.getDate() + args.withinDays);

  return db.stockBatch.findMany({
    where: {
      tenantId: args.tenantId,
      quantity: { gt: 0 },
      expiryDate: { not: null, lte: horizon },
      ...(args.includeExpired ? {} : { isExpired: false }),
    },
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }],
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true } },
    },
  });
}

/**
 * Mark batches whose expiry has passed as expired and write off their remaining quantity
 * from the aggregate WarehouseStock (an OUT movement of type ADJUSTMENT per batch).
 * Returns the batches written off. Idempotent: already-expired/empty batches are skipped.
 */
export async function expireStaleBatches(
  db: Db,
  args: { tenantId: string; asOf?: Date; reference?: string }
) {
  const asOf = args.asOf ?? new Date();
  const stale = await db.stockBatch.findMany({
    where: {
      tenantId: args.tenantId,
      isExpired: false,
      quantity: { gt: 0 },
      expiryDate: { not: null, lt: asOf },
    },
  });

  const writtenOff: { batchId: string; productId: string; quantity: number }[] = [];
  for (const batch of stale) {
    await db.warehouseStock.updateMany({
      where: {
        tenantId: args.tenantId,
        productId: batch.productId,
        warehouseId: batch.warehouseId,
        variantId: batch.variantId,
      },
      data: { quantity: { decrement: batch.quantity } },
    });

    await db.stockMovement.create({
      data: {
        tenantId: args.tenantId,
        productId: batch.productId,
        warehouseId: batch.warehouseId,
        variantId: batch.variantId,
        type: "ADJUSTMENT",
        quantity: batch.quantity,
        batchId: batch.id,
        reference: args.reference ?? `EXPIRY-${asOf.toISOString().slice(0, 10)}`,
        notes: `Expired lot ${batch.batchNo} written off`,
      },
    });

    writtenOff.push({ batchId: batch.id, productId: batch.productId, quantity: batch.quantity });

    await db.stockBatch.update({
      where: { id: batch.id },
      data: { quantity: 0, isExpired: true },
    });
  }

  return writtenOff;
}
