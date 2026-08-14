import { serviceClient } from "@erp/config";
import { TaxRegime, TaxTreatment, validateGstin } from "@erp/tax-india";
import { z } from "zod";
import { fetchTenantTaxProfile } from "@/lib/fetch-tenant-tax-profile";

export const lineItemInputSchema = z
  .array(
    z.object({
      productId: z.string(),
      productName: z.string().optional(),
      name: z.string().optional(),
      variantId: z.string().nullish(),
      quantity: z.number().int().positive().optional(),
      qty: z.number().int().positive().optional(),
      unitPrice: z.number().nonnegative(),
    })
  )
  .min(1);

export type ResolvedLine = {
  productId: string;
  productName: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate: number;
  taxTreatment: string;
  customSnapshot?: Record<string, unknown>;
};

export function normalizeLineItems(
  items: z.infer<typeof lineItemInputSchema>
): Omit<ResolvedLine, "taxRate" | "taxTreatment" | "customSnapshot">[] {
  return items.map((item) => {
    const quantity = item.quantity ?? item.qty;
    const productName = item.productName ?? item.name;
    if (!quantity || !productName) {
      throw new z.ZodError([
        {
          code: "custom",
          message: "Each item needs productName/name and quantity/qty",
          path: ["items"],
        },
      ]);
    }
    return {
      productId: item.productId,
      productName,
      variantId: item.variantId ?? undefined,
      quantity,
      unitPrice: item.unitPrice,
      total: quantity * item.unitPrice,
    };
  });
}

/**
 * Apply product GST only when taxRate is explicitly set on the product.
 * Snapshots HSN + taxTreatment — never recalculate from live product at invoice time.
 */
export async function applyInventoryTaxRates(
  items: Omit<ResolvedLine, "taxRate" | "taxTreatment" | "customSnapshot">[],
  opts: { tenantId: string; userId: string }
): Promise<ResolvedLine[]> {
  const profile = await fetchTenantTaxProfile(opts.tenantId);
  const gstOff = profile.regime === TaxRegime.None;

  const out: ResolvedLine[] = [];
  for (const line of items) {
    const res = await serviceClient.call<{
      data?: {
        taxRate?: number | null;
        hsnCode?: string | null;
        sku?: string | null;
        taxTreatment?: string | null;
      };
    }>("inventory", `/api/products/${line.productId}`, {
      method: "GET",
      tenantId: opts.tenantId,
      userId: opts.userId,
    });
    const product = res.data?.data;
    const rate =
      gstOff || typeof product?.taxRate !== "number" || !Number.isFinite(product.taxRate)
        ? 0
        : product.taxRate;
    const taxTreatment =
      product?.taxTreatment === TaxTreatment.Exempt
        ? TaxTreatment.Exempt
        : product?.taxTreatment === TaxTreatment.ZeroRated
          ? TaxTreatment.ZeroRated
          : TaxTreatment.Taxable;

    out.push({
      ...line,
      taxRate: rate,
      taxTreatment: gstOff ? TaxTreatment.Taxable : taxTreatment,
      customSnapshot: {
        hsnCode: product?.hsnCode ?? undefined,
        sku: product?.sku ?? undefined,
        taxTreatment: gstOff ? TaxTreatment.Taxable : taxTreatment,
        taxRateSnapshot: rate,
      },
    });
  }
  return out;
}

export function computeTotals(
  items: ResolvedLine[],
  opts: { couponDiscount?: number; deliveryFee?: number } = {}
) {
  const couponDiscount = opts.couponDiscount ?? 0;
  const deliveryFee = opts.deliveryFee ?? 0;
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const discountedSubtotal = Math.max(0, subtotal - couponDiscount);
  const tax = items.reduce((sum, i) => {
    if (i.taxTreatment === TaxTreatment.Exempt || i.taxTreatment === TaxTreatment.ZeroRated) {
      return sum;
    }
    const lineShare = subtotal > 0 ? (i.total / subtotal) * discountedSubtotal : i.total;
    const rate = i.taxRate > 1 ? i.taxRate / 100 : i.taxRate;
    return sum + lineShare * rate;
  }, 0);
  const total = discountedSubtotal + tax + deliveryFee;
  return { subtotal, tax, total };
}

export function validateCustomerTaxId(
  taxId: string | null | undefined,
  regime: string
): { ok: true } | { ok: false; error: string } {
  if (!taxId?.trim()) return { ok: true };
  if (regime !== TaxRegime.InGst) return { ok: true };
  const check = validateGstin(taxId);
  if (!check.valid) return { ok: false, error: check.error ?? "Invalid GSTIN" };
  return { ok: true };
}
