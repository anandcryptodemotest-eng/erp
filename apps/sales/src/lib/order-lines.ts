import { serviceClient } from "@erp/config";
import { z } from "zod";

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
};

export function normalizeLineItems(
  items: z.infer<typeof lineItemInputSchema>
): Omit<ResolvedLine, "taxRate">[] {
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

export async function applyInventoryTaxRates(
  items: Omit<ResolvedLine, "taxRate">[],
  opts: { tenantId: string; userId: string }
): Promise<ResolvedLine[]> {
  const fallbackRate = parseFloat(process.env.TAX_RATE ?? "0");
  const out: ResolvedLine[] = [];
  for (const line of items) {
    const res = await serviceClient.call<{ data?: { taxRate?: number | null } }>(
      "inventory",
      `/api/products/${line.productId}`,
      { method: "GET", tenantId: opts.tenantId, userId: opts.userId }
    );
    const rate = res.data?.data?.taxRate;
    out.push({
      ...line,
      taxRate: typeof rate === "number" && Number.isFinite(rate) ? rate : fallbackRate,
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
    const lineShare = subtotal > 0 ? (i.total / subtotal) * discountedSubtotal : i.total;
    return sum + lineShare * i.taxRate;
  }, 0);
  const total = discountedSubtotal + tax + deliveryFee;
  return { subtotal, tax, total };
}
