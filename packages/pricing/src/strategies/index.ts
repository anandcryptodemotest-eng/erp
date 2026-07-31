import type {
  Measure,
  PriceQuote,
  PricingBreakdownStep,
  PricingContext,
  PricingBasis as PricingBasisType,
  ResolvedRate,
} from "../context/types";
import { PricingBasis } from "../context/types";

export interface PricingStrategy {
  readonly basis: PricingBasisType;
  quote(ctx: PricingContext, measure: Measure, rate: ResolvedRate): Omit<PriceQuote, "rounding">;
}

function applyDiscount(
  baseLine: number,
  discount: PricingContext["discount"]
): { net: number; steps: PricingBreakdownStep[] } {
  const steps: PricingBreakdownStep[] = [];
  let net = baseLine;
  if (discount?.percent != null && discount.percent > 0) {
    const amt = (net * discount.percent) / 100;
    net -= amt;
    steps.push({ code: "DISCOUNT", label: `Discount ${discount.percent}%`, amount: -amt });
  } else if (discount?.amount != null && discount.amount > 0) {
    net -= discount.amount;
    steps.push({ code: "DISCOUNT", label: "Discount", amount: -discount.amount });
  }
  return { net, steps };
}

export const eachStrategy: PricingStrategy = {
  basis: PricingBasis.PER_EACH,
  quote(ctx, measure, rate) {
    const qty = ctx.quantity;
    const unitPrice = rate.amount;
    const base = unitPrice * qty;
    const { net, steps: disc } = applyDiscount(base, ctx.discount);
    const breakdown: PricingBreakdownStep[] = [
      { code: "QTY", label: "Quantity", quantity: qty, unit: "each", amount: qty },
      { code: "RATE", label: "Rate", quantity: 1, unit: rate.per, amount: rate.amount },
      { code: "BASE", label: "Base", amount: base },
      ...disc,
      { code: "NET", label: "Net", amount: net },
    ];
    return {
      currency: ctx.currency,
      basis: PricingBasis.PER_EACH,
      pricingUom: "each",
      measure,
      rate,
      commercialQuantity: qty,
      resolvedQuantity: qty,
      unitPrice,
      lineTotal: net,
      breakdown,
    };
  },
};

export const areaStrategy: PricingStrategy = {
  basis: PricingBasis.PER_AREA,
  quote(ctx, measure, rate) {
    const area = measure.area;
    if (area == null || area <= 0) {
      throw new Error("PER_AREA requires a positive area measure (e.g. size 8x4)");
    }
    const qty = ctx.quantity;
    const unitPrice = area * rate.amount;
    const resolvedQuantity = area * qty;
    const base = unitPrice * qty;
    const { net, steps: disc } = applyDiscount(base, ctx.discount);
    const uom = measure.uom || rate.per || "sq_ft";
    const breakdown: PricingBreakdownStep[] = [
      { code: "AREA", label: "Area per unit", quantity: area, unit: uom, amount: area },
      { code: "RATE", label: "Rate", quantity: 1, unit: rate.per, amount: rate.amount },
      { code: "BASE", label: "Base (per unit × qty)", amount: base },
      ...disc,
      { code: "NET", label: "Net", amount: net },
    ];
    return {
      currency: ctx.currency,
      basis: PricingBasis.PER_AREA,
      pricingUom: uom,
      measure,
      rate,
      commercialQuantity: qty,
      resolvedQuantity,
      unitPrice,
      lineTotal: net,
      breakdown,
    };
  },
};

export const weightStrategy: PricingStrategy = {
  basis: PricingBasis.PER_WEIGHT,
  quote(ctx, measure, rate) {
    const weight = measure.weight;
    if (weight == null || weight <= 0) {
      throw new Error("PER_WEIGHT requires a positive weight measure");
    }
    const qty = ctx.quantity;
    const unitPrice = weight * rate.amount;
    const resolvedQuantity = weight * qty;
    const base = unitPrice * qty;
    const { net, steps: disc } = applyDiscount(base, ctx.discount);
    const breakdown: PricingBreakdownStep[] = [
      { code: "WEIGHT", label: "Weight per unit", quantity: weight, unit: "kg", amount: weight },
      { code: "RATE", label: "Rate", quantity: 1, unit: rate.per, amount: rate.amount },
      { code: "BASE", label: "Base", amount: base },
      ...disc,
      { code: "NET", label: "Net", amount: net },
    ];
    return {
      currency: ctx.currency,
      basis: PricingBasis.PER_WEIGHT,
      pricingUom: "kg",
      measure,
      rate,
      commercialQuantity: qty,
      resolvedQuantity,
      unitPrice,
      lineTotal: net,
      breakdown,
    };
  },
};

export const volumeStrategy: PricingStrategy = {
  basis: PricingBasis.PER_VOLUME,
  quote(ctx, measure, rate) {
    const volume = measure.volume;
    if (volume == null || volume <= 0) {
      throw new Error("PER_VOLUME requires a positive volume measure");
    }
    const qty = ctx.quantity;
    const unitPrice = volume * rate.amount;
    const resolvedQuantity = volume * qty;
    const base = unitPrice * qty;
    const { net, steps: disc } = applyDiscount(base, ctx.discount);
    const breakdown: PricingBreakdownStep[] = [
      { code: "VOLUME", label: "Volume per unit", quantity: volume, unit: "m3", amount: volume },
      { code: "RATE", label: "Rate", quantity: 1, unit: rate.per, amount: rate.amount },
      { code: "BASE", label: "Base", amount: base },
      ...disc,
      { code: "NET", label: "Net", amount: net },
    ];
    return {
      currency: ctx.currency,
      basis: PricingBasis.PER_VOLUME,
      pricingUom: "m3",
      measure,
      rate,
      commercialQuantity: qty,
      resolvedQuantity,
      unitPrice,
      lineTotal: net,
      breakdown,
    };
  },
};

export const formulaStub: PricingStrategy = {
  basis: PricingBasis.FORMULA,
  quote() {
    throw new Error("FORMULA pricing is not enabled in this engine version");
  },
};

export const customStub: PricingStrategy = {
  basis: PricingBasis.CUSTOM,
  quote() {
    throw new Error("CUSTOM pricing is not enabled in this engine version");
  },
};
