import type { PrismaClient } from "../generated/prisma";
import { prisma } from "./prisma";

/** Prisma client or interactive transaction client */
type Db = PrismaClient | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export function normalizeVariantId(variantId?: string | null): string | null {
  return variantId && variantId.length > 0 ? variantId : null;
}

/** Find stock row for product+warehouse+(optional variant). */
export async function findWarehouseStock(
  db: Db,
  args: { productId: string; warehouseId: string; variantId?: string | null; tenantId?: string }
) {
  const variantId = normalizeVariantId(args.variantId);
  return db.warehouseStock.findFirst({
    where: {
      productId: args.productId,
      warehouseId: args.warehouseId,
      variantId,
      ...(args.tenantId ? { tenantId: args.tenantId } : {}),
    },
  });
}

/**
 * Increment (or create) stock for product+warehouse+variant.
 * SIMPLE products use variantId = null; VARIANT products must pass variantId.
 */
export async function upsertStockDelta(
  db: Db,
  args: {
    tenantId: string;
    productId: string;
    warehouseId: string;
    variantId?: string | null;
    quantityDelta: number;
  }
) {
  const variantId = normalizeVariantId(args.variantId);
  const existing = await findWarehouseStock(db, {
    productId: args.productId,
    warehouseId: args.warehouseId,
    variantId,
    tenantId: args.tenantId,
  });

  if (existing) {
    return db.warehouseStock.update({
      where: { id: existing.id },
      data: { quantity: { increment: args.quantityDelta } },
    });
  }

  return db.warehouseStock.create({
    data: {
      tenantId: args.tenantId,
      productId: args.productId,
      warehouseId: args.warehouseId,
      variantId,
      quantity: Math.max(0, args.quantityDelta),
    },
  });
}

/** Available = on-hand − open reservations for the same product+warehouse+variant scope. */
export async function availableQty(
  db: Db,
  args: {
    tenantId: string;
    productId: string;
    warehouseId: string;
    variantId?: string | null;
  }
): Promise<{ onHand: number; reserved: number; available: number }> {
  const variantId = normalizeVariantId(args.variantId);
  const stock = await findWarehouseStock(db, { ...args, variantId });
  const onHand = stock?.quantity ?? 0;

  const reservedAgg = await db.stockReservation.aggregate({
    where: {
      tenantId: args.tenantId,
      productId: args.productId,
      warehouseId: args.warehouseId,
      isReleased: false,
      variantId,
    },
    _sum: { reservedQty: true },
  });

  const reserved = reservedAgg._sum.reservedQty ?? 0;
  return { onHand, reserved, available: onHand - reserved };
}

/** Enforce VARIANT products must supply variantId on stock ops. */
export async function assertVariantStockScope(
  db: Db,
  args: { tenantId: string; productId: string; variantId?: string | null }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const product = await db.product.findFirst({
    where: { id: args.productId, tenantId: args.tenantId },
    select: { id: true, productStructure: true, sku: true },
  });
  if (!product) return { ok: false, error: "Product not found", status: 404 };

  const variantId = normalizeVariantId(args.variantId);
  if (product.productStructure === "VARIANT" && !variantId) {
    return {
      ok: false,
      error: `Product ${product.sku} requires variantId for stock operations`,
      status: 400,
    };
  }

  if (variantId) {
    const variant = await db.productVariant.findFirst({
      where: { id: variantId, productId: product.id, tenantId: args.tenantId, isActive: true },
      select: { id: true },
    });
    if (!variant) return { ok: false, error: "Variant not found", status: 404 };
  }

  return { ok: true };
}
