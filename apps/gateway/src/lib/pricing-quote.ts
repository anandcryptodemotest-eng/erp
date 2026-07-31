import { getTenantId, getToken } from "@/lib/admin-api";

const BASE =
  typeof window !== "undefined" ? "" : "http://127.0.0.1:3010/admin";

export type PricingQuotePayload = {
  currency?: string;
  basis?: string;
  pricingUom?: string;
  unitPrice: number;
  lineTotal: number;
  resolvedQuantity?: number;
  commercialQuantity?: number;
  measure?: {
    length?: number | null;
    width?: number | null;
    height?: number | null;
    area?: number | null;
    volume?: number | null;
    weight?: number | null;
    uom?: string;
  };
  rate?: { amount?: number; per?: string; source?: string };
  breakdown?: { code: string; label: string; amount: number; quantity?: number; unit?: string }[];
};

export type PricingSnapshotPayload = {
  version: 1;
  engineVersion: string;
  pricingRuleVersion: number;
  strategy: string;
  input?: Record<string, unknown>;
  measure?: Record<string, unknown>;
  rate?: Record<string, unknown>;
  output?: Record<string, unknown>;
  breakdown?: PricingQuotePayload["breakdown"];
  rounding?: { policy: string; precision: number };
  overridden?: boolean;
};

export type QuoteSuccess = {
  ok: true;
  quote: PricingQuotePayload;
  snapshot: PricingSnapshotPayload;
  quoteTimestamp: string;
};

export type QuoteFailure = {
  ok: false;
  /** Soft = service unavailable; Hard = invalid config / bad request */
  soft: boolean;
  error: string;
  status?: number;
};

export type QuoteResult = QuoteSuccess | QuoteFailure;

export type DraftProductQuote = {
  pricingBasis: string;
  baseRate?: number | null;
  sellPrice?: number | null;
  pricingUom?: string | null;
  weight?: number | null;
  weightUnit?: string | null;
  categoryId?: string | null;
  attributes?: Record<string, unknown>;
  attributeDefs?: {
    key: string;
    measureRole?: string | null;
    measureUnit?: string | null;
    sizePattern?: string | null;
  }[];
};

export type QuoteRequest =
  | {
      productId: string;
      variantId?: string;
      quantity?: number;
      attributes?: Record<string, unknown>;
      customerId?: string;
      priceListId?: string;
      currency?: string;
    }
  | {
      productId: null;
      draftProduct: DraftProductQuote;
      variantId?: string;
      quantity?: number;
      attributes?: Record<string, unknown>;
      customerId?: string;
      priceListId?: string;
      currency?: string;
    };

/**
 * Call POST /api/pricing/quote. Classifies soft (5xx/network) vs hard (4xx) failures.
 * UI must never calculate prices — only render this result.
 */
export async function fetchPricingQuote(body: QuoteRequest): Promise<QuoteResult> {
  try {
    const res = await fetch(`${BASE}/api/pricing/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
        "x-tenant-id": getTenantId(),
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      data?: { quote?: PricingQuotePayload; snapshot?: PricingSnapshotPayload };
    };

    if (!res.ok) {
      const soft = res.status >= 500 || res.status === 0;
      return {
        ok: false,
        soft,
        error: json.error ?? `HTTP ${res.status}`,
        status: res.status,
      };
    }

    const quote = json.data?.quote;
    const snapshot = json.data?.snapshot;
    if (!quote || snapshot == null) {
      return { ok: false, soft: true, error: "Invalid quote response", status: res.status };
    }

    return {
      ok: true,
      quote,
      snapshot,
      quoteTimestamp: new Date().toISOString(),
    };
  } catch (e: unknown) {
    return {
      ok: false,
      soft: true,
      error: e instanceof Error ? e.message : "Pricing service unavailable",
    };
  }
}

/** Shape stored on sales order line customSnapshot.pricing */
export function buildLinePricingMeta(
  result: QuoteSuccess,
  opts?: { overridden?: boolean; finalUnitPrice?: number }
) {
  const overridden =
    opts?.overridden === true ||
    (opts?.finalUnitPrice != null &&
      Math.abs(opts.finalUnitPrice - result.quote.unitPrice) > 0.0001);

  return {
    pricingSnapshot: {
      ...result.snapshot,
      overridden: overridden || result.snapshot.overridden,
    },
    pricingEngineVersion: result.snapshot.engineVersion,
    quoteTimestamp: result.quoteTimestamp,
    quotedUnitPrice: result.quote.unitPrice,
  };
}
