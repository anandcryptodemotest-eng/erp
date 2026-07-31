import type { PriceQuote, PricingContext, PricingSnapshot } from "./context/types";
import { PricingBasis } from "./context/types";
import { resolveMeasure } from "./measures/resolve-measure";
import { resolveRate } from "./rates/resolve-rate";
import { createDefaultRegistry, type StrategyRegistry } from "./registry/strategy-registry";
import {
  defaultRoundingPolicy,
  type RoundingPolicy,
} from "./rounding/rounding-policy";
import { buildSnapshot } from "./snapshots/build-snapshot";

export type QuotePriceOptions = {
  registry?: StrategyRegistry;
  rounding?: RoundingPolicy;
};

/**
 * Full pipeline: Measure → Rate → StrategyRegistry → RoundingPolicy → Quote (+ Snapshot).
 * No basis switch here — strategies are resolved from the registry.
 */
export function quotePrice(
  ctx: PricingContext,
  opts: QuotePriceOptions = {}
): { quote: PriceQuote; snapshot: PricingSnapshot } {
  const registry = opts.registry ?? createDefaultRegistry();
  const rounding = opts.rounding ?? defaultRoundingPolicy;

  const pricingUom = ctx.product.pricingUom;
  const linearUom =
    pricingUom === "sq_m" || pricingUom === "m2" ? "m" : pricingUom === "sq_ft" || !pricingUom ? "ft" : "ft";
  const areaUom = pricingUom && (pricingUom.startsWith("sq_") || pricingUom.includes("m2"))
    ? pricingUom
    : ctx.product.pricingBasis === PricingBasis.PER_AREA
      ? "sq_ft"
      : "sq_ft";

  const measure = resolveMeasure(ctx.attributes, ctx.attributeDefs, {
    targetLinearUom: linearUom,
    targetAreaUom: areaUom,
    productWeight: ctx.product.weight,
    productWeightUnit: ctx.product.weightUnit,
  });

  const rate = resolveRate(ctx);
  const strategy = registry.resolve(ctx.product.pricingBasis);
  const raw = strategy.quote(ctx, measure, rate);

  const unitPrice = rounding.round(raw.unitPrice, ctx.currency, ctx);
  const lineTotal = rounding.round(raw.lineTotal, ctx.currency, ctx);

  const quote: PriceQuote = {
    ...raw,
    unitPrice,
    lineTotal,
    rounding: { policy: rounding.name, precision: rounding.precision },
    breakdown: [
      ...raw.breakdown.filter((s) => s.code !== "NET"),
      {
        code: "ROUNDING",
        label: `Rounding (${rounding.name})`,
        amount: lineTotal - raw.lineTotal,
      },
      { code: "NET", label: "Net", amount: lineTotal },
    ],
  };

  return { quote, snapshot: buildSnapshot(ctx, quote) };
}
