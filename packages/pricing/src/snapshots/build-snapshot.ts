import {
  PRICING_ENGINE_VERSION,
  type PriceQuote,
  type PricingContext,
  type PricingSnapshot,
} from "../context/types";

export function buildSnapshot(
  ctx: PricingContext,
  quote: PriceQuote,
  opts?: { overridden?: boolean }
): PricingSnapshot {
  return {
    version: 1,
    engineVersion: PRICING_ENGINE_VERSION,
    pricingRuleVersion: ctx.pricingRuleVersion ?? 1,
    strategy: quote.basis,
    input: {
      attributes: ctx.attributes,
      commercialQuantity: ctx.quantity,
      customerId: ctx.customer?.id ?? null,
      at: ctx.at.toISOString(),
    },
    measure: quote.measure,
    rate: quote.rate,
    output: {
      unitPrice: quote.unitPrice,
      lineTotal: quote.lineTotal,
      resolvedQuantity: quote.resolvedQuantity,
      pricingUom: quote.pricingUom,
    },
    breakdown: quote.breakdown,
    rounding: quote.rounding,
    overridden: opts?.overridden,
  };
}
