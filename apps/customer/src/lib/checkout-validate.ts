import { api } from "@/lib/api-client";
import type { CartItem } from "@/lib/cart-store";
import { saveCart } from "@/lib/cart-store";

export type ValidatedLine = CartItem & { stockOk: boolean; priceChanged: boolean };

export type CartValidationResult = {
  ok: boolean;
  lines: ValidatedLine[];
  errors: string[];
  warnings: string[];
};

function validPrice(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

type ProductPayload = {
  sellPrice?: number | null;
  name?: string;
  stocks?: { quantity: number }[];
  isActive?: boolean;
  pricingBasis?: string | null;
  baseRate?: number | null;
  pricingUom?: string | null;
  customAttributes?: Record<string, unknown> | null;
};

type QuotePayload = {
  quote?: {
    unitPrice?: number;
    lineTotal?: number;
    rate?: { amount: number; per: string };
    measure?: { area?: number | null; weight?: number | null; volume?: number | null; uom?: string };
    basis?: string;
    resolvedQuantity?: number;
  };
  unitPrice?: number;
};

async function resolveUnitPrice(
  line: CartItem,
  product: ProductPayload
): Promise<{ unitPrice: number | null; from: "quote" | "sellPrice" | "cart" }> {
  const attrs = {
    ...(product.customAttributes ?? {}),
    ...(line.selectedAttributes ?? {}),
  };
  const needsQuote =
    (product.pricingBasis && product.pricingBasis !== "PER_EACH") ||
    !validPrice(product.sellPrice) ||
    Object.keys(line.selectedAttributes ?? {}).length > 0;

  if (needsQuote) {
    const quoteRes = await api<{ data?: QuotePayload }>("portal", "/api/portal/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.qty,
        attributes: attrs,
      }),
    });
    const quote = quoteRes.data?.data?.quote ?? quoteRes.data?.data;
    const qp = quote?.unitPrice;
    if (validPrice(qp)) return { unitPrice: qp, from: "quote" };
  }

  if (validPrice(product.sellPrice)) {
    return { unitPrice: product.sellPrice, from: "sellPrice" };
  }

  // Trust cart price from configure/add-to-cart when catalog has no flat sellPrice
  if (validPrice(line.price) && line.price > 0) {
    return { unitPrice: line.price, from: "cart" };
  }

  return { unitPrice: null, from: "cart" };
}

/**
 * Validate prices + stock, requote lines, persist corrected cart.
 * Works for PER_EACH and measured bases (PER_AREA / PER_WEIGHT / PER_VOLUME).
 */
export async function validateCartForCheckout(items: CartItem[]): Promise<CartValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines: ValidatedLine[] = [];

  for (const line of items) {
    const res = await api<{ data: ProductPayload }>(
      "portal",
      `/api/portal/products/${line.productId}`
    );

    if (res.error || !res.data?.data) {
      errors.push(`Could not validate ${line.name || line.productId}`);
      continue;
    }

    const product = res.data.data;
    if (product.isActive === false) {
      errors.push(`${product.name || line.name} is no longer available`);
      continue;
    }

    const { unitPrice: finalPrice, from } = await resolveUnitPrice(line, product);
    if (!validPrice(finalPrice)) {
      errors.push(
        `No price for ${product.name || line.name}. Open the product, configure options, and add to cart again.`
      );
      continue;
    }

    const stockQty = (product.stocks ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0);
    const stockOk = stockQty <= 0 ? true : stockQty >= line.qty;
    if (!stockOk) {
      errors.push(
        `Insufficient stock for ${product.name || line.name} (need ${line.qty}, have ${stockQty})`
      );
    }

    const priceChanged = Math.abs(finalPrice - line.price) > 0.001;
    if (priceChanged && from !== "cart") {
      warnings.push(
        `Price updated for ${product.name || line.name}: ₹${line.price} → ₹${finalPrice}`
      );
    }

    lines.push({
      ...line,
      name: product.name || line.name,
      price: finalPrice,
      lineTotal: finalPrice * line.qty,
      pricingBasis: product.pricingBasis ?? line.pricingBasis,
      stockOk,
      priceChanged,
    });
  }

  if (lines.length) {
    saveCart(lines.map(({ stockOk: _s, priceChanged: _p, ...rest }) => rest));
  }

  const ok = errors.length === 0 && lines.length > 0;
  return { ok, lines, errors, warnings };
}

/**
 * Optional inventory reservation hook. Currently a no-op until the portal
 * collects warehouseId; call site remains for future enablement.
 */
export async function reserveInventoryForCheckout(_args: {
  reference: string;
  lines: CartItem[];
}): Promise<{ reserved: boolean; skipped: boolean; error?: string }> {
  return { reserved: false, skipped: true };
}
