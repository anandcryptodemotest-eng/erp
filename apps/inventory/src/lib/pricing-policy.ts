/**
 * PricingPolicy — commercial rules for Create Product.
 * Engine asks resolve(row); strategies (SAME | CONFIGURATION | future) stay inside the policy.
 */

export type PricingPolicyType = "SAME" | "CONFIGURATION";

export type PriceSource = "OVERRIDE" | "CONFIGURATION" | "BASE" | "MEASURED";

export type PricingPolicy = {
  type: PricingPolicyType;
  /** Commercial starting price before configuration rules (PER_EACH). */
  basePrice: number | null;
  /** Configuration key when type === CONFIGURATION */
  attribute?: string;
  /** Option value → sell price */
  values?: Record<string, number>;
  /** Row key (index or fingerprint) → sell price override */
  overrides?: Record<string, number>;
};

export type ResolvedPrice = {
  amount: number | null;
  source: PriceSource;
  /** Human detail e.g. "Storage = 256 GB" */
  detail?: string;
};

export type PolicyRow = {
  index: number;
  fingerprint?: string | null;
  customAttributes: Record<string, string>;
};

function num(n: unknown): number | null {
  if (n == null || n === "") return null;
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

export function normalizePricingPolicy(
  raw: unknown,
  fallbackBase: number | null = null
): PricingPolicy {
  if (!raw || typeof raw !== "object") {
    return { type: "SAME", basePrice: fallbackBase };
  }
  const o = raw as Record<string, unknown>;
  const type: PricingPolicyType = o.type === "CONFIGURATION" ? "CONFIGURATION" : "SAME";
  const basePrice = num(o.basePrice) ?? fallbackBase;
  const attribute = typeof o.attribute === "string" && o.attribute.trim() ? o.attribute.trim() : undefined;
  const values: Record<string, number> = {};
  if (o.values && typeof o.values === "object" && !Array.isArray(o.values)) {
    for (const [k, v] of Object.entries(o.values as Record<string, unknown>)) {
      const n = num(v);
      if (n != null) values[k] = n;
    }
  }
  const overrides: Record<string, number> = {};
  if (o.overrides && typeof o.overrides === "object" && !Array.isArray(o.overrides)) {
    for (const [k, v] of Object.entries(o.overrides as Record<string, unknown>)) {
      const n = num(v);
      if (n != null) overrides[k] = n;
    }
  }
  return {
    type,
    basePrice,
    attribute,
    values: Object.keys(values).length ? values : undefined,
    overrides: Object.keys(overrides).length ? overrides : undefined,
  };
}

/**
 * Resolve commercial sell price for a planned product row (PER_EACH path).
 * Order: override → configuration value → basePrice.
 */
export function resolvePrice(
  policy: PricingPolicy,
  row: PolicyRow,
  attrLabel?: string
): ResolvedPrice {
  const overrideKeys = [
    String(row.index),
    row.fingerprint ?? "",
  ].filter(Boolean);
  for (const k of overrideKeys) {
    const ov = policy.overrides?.[k];
    if (ov != null) {
      return { amount: ov, source: "OVERRIDE", detail: "Manual Override" };
    }
  }

  if (policy.type === "CONFIGURATION" && policy.attribute) {
    const rawVal = row.customAttributes[policy.attribute];
    if (rawVal != null && String(rawVal).trim() !== "") {
      const key = String(rawVal);
      const priced = policy.values?.[key];
      if (priced != null) {
        const label = attrLabel || policy.attribute;
        return {
          amount: priced,
          source: "CONFIGURATION",
          detail: `${label} = ${key}`,
        };
      }
    }
  }

  return {
    amount: policy.basePrice,
    source: "BASE",
    detail: policy.basePrice != null ? "Base Price" : undefined,
  };
}
