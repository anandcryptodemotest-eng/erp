import type { PricingContext } from "../context/types";

export type RoundingPolicyName = "currency_minor" | "nearest" | "up" | "down" | "bankers";

export interface RoundingPolicy {
  readonly name: RoundingPolicyName;
  readonly precision: number;
  round(amount: number, currency: string, ctx: PricingContext): number;
}

/** v1 default: standard half-up to currency minor units (2 for most, including INR). */
export class CurrencyMinorRounding implements RoundingPolicy {
  readonly name = "currency_minor" as const;
  constructor(readonly precision = 2) {}

  round(amount: number): number {
    const f = 10 ** this.precision;
    return Math.round((amount + Number.EPSILON) * f) / f;
  }
}

export const defaultRoundingPolicy = new CurrencyMinorRounding(2);
