import type { PriceListItemRef, PricingContext, ResolvedRate } from "../context/types";
import { PricingBasis } from "../context/types";

/**
 * v1: Price list (best matching minQty) → variant/product baseRate → sellPrice (PER_EACH).
 *
 * Future ladder (documented): Contract → Customer → Group → Channel → Branch →
 * PriceList → Product.baseRate → Default
 */
export function resolveRate(ctx: PricingContext): ResolvedRate {
  const basis = ctx.product.pricingBasis;
  const per = ctx.product.pricingUom || defaultPer(basis);
  const qty = ctx.quantity;

  const listHit = pickPriceListItem(ctx.priceListItems ?? [], ctx.product.id, ctx.variant?.id, qty);
  if (listHit) {
    return { amount: listHit.price, per, source: "price_list" };
  }

  if (ctx.variant?.baseRate != null && Number.isFinite(ctx.variant.baseRate)) {
    return { amount: ctx.variant.baseRate, per, source: "variant_base_rate" };
  }
  if (ctx.product.baseRate != null && Number.isFinite(ctx.product.baseRate)) {
    return { amount: ctx.product.baseRate, per, source: "product_base_rate" };
  }

  if (basis === PricingBasis.PER_EACH) {
    const sell = ctx.variant?.sellPrice ?? ctx.product.sellPrice;
    if (sell != null && Number.isFinite(sell)) {
      return { amount: sell, per: "each", source: "product_sell_price" };
    }
  }

  throw new Error("No rate found (price list / baseRate / sellPrice)");
}

function defaultPer(basis: string): string {
  switch (basis) {
    case PricingBasis.PER_AREA:
      return "sq_ft";
    case PricingBasis.PER_WEIGHT:
      return "kg";
    case PricingBasis.PER_VOLUME:
      return "m3";
    default:
      return "each";
  }
}

function pickPriceListItem(
  items: PriceListItemRef[],
  productId: string,
  variantId: string | null | undefined,
  qty: number
): PriceListItemRef | null {
  const candidates = items
    .filter((i) => i.productId === productId)
    .filter((i) => (variantId ? i.variantId === variantId || !i.variantId : !i.variantId))
    .filter((i) => i.minQty <= qty)
    .sort((a, b) => b.minQty - a.minQty);
  return candidates[0] ?? null;
}
