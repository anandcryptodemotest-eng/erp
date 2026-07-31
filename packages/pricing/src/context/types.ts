/** @erp/pricing engine version — bumped when quote math/semantics change. */
export const PRICING_ENGINE_VERSION = "1.0.0";

export const PricingBasis = {
  PER_EACH: "PER_EACH",
  PER_AREA: "PER_AREA",
  PER_WEIGHT: "PER_WEIGHT",
  PER_VOLUME: "PER_VOLUME",
  FORMULA: "FORMULA",
  CUSTOM: "CUSTOM",
} as const;

export type PricingBasis = (typeof PricingBasis)[keyof typeof PricingBasis];

export type MeasureRole =
  | "LENGTH"
  | "WIDTH"
  | "HEIGHT"
  | "THICKNESS"
  | "AREA"
  | "VOLUME"
  | "WEIGHT"
  | "NONE";

export type AttributeDef = {
  key: string;
  measureRole?: MeasureRole | null;
  measureUnit?: string | null;
  /** e.g. "{L}x{W}" for size SELECT values like "8x4" */
  sizePattern?: string | null;
};

export type Measure = {
  length: number | null;
  width: number | null;
  height: number | null;
  thickness: number | null;
  area: number | null;
  volume: number | null;
  weight: number | null;
  uom: string;
};

export function emptyMeasure(uom = "each"): Measure {
  return {
    length: null,
    width: null,
    height: null,
    thickness: null,
    area: null,
    volume: null,
    weight: null,
    uom,
  };
}

export type BreakdownCode =
  | "AREA"
  | "VOLUME"
  | "WEIGHT"
  | "QTY"
  | "RATE"
  | "BASE"
  | "DISCOUNT"
  | "MARKUP"
  | "ROUNDING"
  | "NET";

export type PricingBreakdownStep = {
  code: BreakdownCode;
  label: string;
  quantity?: number;
  unit?: string;
  amount: number;
};

export type ResolvedRate = {
  amount: number;
  per: string;
  source: string;
};

export type PriceQuote = {
  currency: string;
  basis: PricingBasis;
  pricingUom: string;
  measure: Measure;
  rate: ResolvedRate;
  commercialQuantity: number;
  resolvedQuantity: number;
  unitPrice: number;
  lineTotal: number;
  breakdown: PricingBreakdownStep[];
  rounding: { policy: string; precision: number };
};

export type PricingSnapshot = {
  version: 1;
  engineVersion: string;
  pricingRuleVersion: number;
  strategy: PricingBasis;
  input: {
    attributes: Record<string, unknown>;
    commercialQuantity: number;
    customerId?: string | null;
    at: string;
  };
  measure: Measure;
  rate: ResolvedRate;
  output: {
    unitPrice: number;
    lineTotal: number;
    resolvedQuantity: number;
    pricingUom: string;
  };
  breakdown: PricingBreakdownStep[];
  rounding?: { policy: string; precision: number };
  overridden?: boolean;
};

export type PricingProduct = {
  id: string;
  pricingBasis: PricingBasis;
  baseRate?: number | null;
  sellPrice?: number | null;
  pricingUom?: string | null;
  weight?: number | null;
  weightUnit?: string | null;
};

export type PricingVariant = {
  id: string;
  baseRate?: number | null;
  sellPrice?: number | null;
};

export type PriceListItemRef = {
  productId: string;
  variantId?: string | null;
  minQty: number;
  /** Rate in pricing UOM (or per-each price when PER_EACH). */
  price: number;
};

export type PricingContext = {
  tenantId: string;
  currency: string;
  at: Date;
  product: PricingProduct;
  variant?: PricingVariant | null;
  attributes: Record<string, unknown>;
  attributeDefs: AttributeDef[];
  customer?: { id: string; priceListId?: string | null; groupId?: string | null } | null;
  priceListItems?: PriceListItemRef[];
  channel?: string | null;
  branchId?: string | null;
  quantity: number;
  discount?: { amount?: number; percent?: number } | null;
  /** Tenant rule-set version for snapshot reproducibility. */
  pricingRuleVersion?: number;
};
