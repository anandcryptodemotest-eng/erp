import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";

export type CreateBillInput = {
  warehouseId: string;
  stockLocationId?: string;
  offlineId?: string;
  countryCode?: string;
  currency?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: "CASH" | "UPI" | "CARD" | "WALLET" | "SPLIT";
  status: "COMPLETED" | "HELD";
  shiftId?: string;
  notes?: string;
  items: {
    productId: string;
    variantId?: string;
    productName: string;
    sku?: string;
    barcode?: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxCode?: string;
    taxRate?: number;
  }[];
};

export type CreateBillResult = {
  status: number;
  data?: unknown;
  error?: string;
  stockWarning?: string;
};

function normalizeRate(rate: number): number {
  if (Number.isNaN(rate) || rate < 0) return 0;
  return rate > 1 ? rate / 100 : rate;
}

/**
 * Core POS bill creation shared by the online POST /api/bills and the offline
 * sync endpoint. Resolves per-product tax (blocking unapproved HSN/tax), creates
 * the Bill + items, records the cash-shift entry, and deducts stock from the
 * warehouse via the atomic, idempotent inventory deduct. Returns a status + body
 * rather than a Response so both callers can compose their own output.
 */
export async function createBill(
  tenantId: string,
  userId: string,
  input: CreateBillInput,
  opts: { countryCodeHeader?: string; currencyHeader?: string } = {}
): Promise<CreateBillResult> {
  const {
    warehouseId,
    stockLocationId,
    offlineId,
    items,
    shiftId,
    customerId,
    customerName,
    customerPhone,
    paymentMethod,
    status,
    notes,
  } = input;

  const countryCode = (input.countryCode ?? opts.countryCodeHeader ?? "IN").toUpperCase();
  const currency = (input.currency ?? opts.currencyHeader ?? (countryCode === "IN" ? "INR" : "USD")).toUpperCase();

  if (shiftId) {
    const shift = await prisma.cashShift.findFirst({ where: { id: shiftId, tenantId, status: "OPEN" } });
    if (!shift) return { status: 404, error: "Shift not found or not open" };
  }

  const activeTaxRates = await prisma.taxRate.findMany({
    where: { tenantId, countryCode, isActive: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  const taxRateByCode = new Map(activeTaxRates.map((t) => [t.code, t]));
  const defaultTaxRate = activeTaxRates.find((t) => t.isDefault);
  const envTaxRate = normalizeRate(parseFloat(process.env.TAX_RATE ?? "0.10"));

  const uniqueProductIds = Array.from(new Set(items.map((item) => item.productId)));
  const productTaxMeta = new Map<string, {
    taxCode?: string;
    taxRate?: number;
    countryCode?: string;
    hsnCode?: string;
    taxApprovalStatus?: string;
  }>();

  await Promise.all(
    uniqueProductIds.map(async (productId) => {
      const response = await serviceClient.call<{
        data?: { taxCode?: string; taxRate?: number; countryCode?: string; hsnCode?: string; taxApprovalStatus?: string };
      }>("inventory", `/api/products/${productId}`, { method: "GET", tenantId, userId });
      const payload = response.data?.data;
      if (response.status >= 200 && response.status < 300 && payload) {
        productTaxMeta.set(productId, {
          taxCode: payload.taxCode,
          taxRate: payload.taxRate,
          countryCode: payload.countryCode,
          hsnCode: payload.hsnCode,
          taxApprovalStatus: payload.taxApprovalStatus,
        });
      }
    })
  );

  const blockedProducts = items
    .map((item) => {
      const meta = productTaxMeta.get(item.productId);
      const missingHsn = !meta?.hsnCode;
      const unapproved = meta?.taxApprovalStatus !== "APPROVED";
      if (!missingHsn && !unapproved) return null;
      return item.productName;
    })
    .filter((name): name is string => !!name);

  if (blockedProducts.length > 0) {
    return {
      status: 409,
      error: `Tax not approved for products: ${Array.from(new Set(blockedProducts)).join(", ")}. Review HSN/tax approval before billing.`,
    };
  }

  const billItems = items.map((item) => {
    const meta = productTaxMeta.get(item.productId);
    const itemTaxCode = meta?.taxCode ?? item.taxCode;
    const configuredRate = itemTaxCode ? taxRateByCode.get(itemTaxCode) : undefined;
    const chosenRate = normalizeRate(
      meta?.taxRate ?? configuredRate?.rate ?? item.taxRate ?? defaultTaxRate?.rate ?? envTaxRate
    );
    const taxableAmount = Math.max(0, item.quantity * item.unitPrice - item.discount);
    const taxAmount = taxableAmount * chosenRate;
    const total = taxableAmount + taxAmount;
    return {
      ...item,
      taxableAmount,
      taxCode: itemTaxCode,
      taxType: configuredRate?.taxType ?? defaultTaxRate?.taxType ?? (countryCode === "IN" ? "GST" : "VAT"),
      taxRate: chosenRate,
      taxAmount,
      total,
    };
  });

  const subtotal = billItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountTotal = billItems.reduce((s, i) => s + i.discount, 0);
  const taxAmount = billItems.reduce((s, i) => s + i.taxAmount, 0);
  const total = billItems.reduce((s, i) => s + i.total, 0);
  const billTaxRate = subtotal > 0 ? taxAmount / subtotal : 0;

  const count = await prisma.bill.count({ where: { tenantId } });
  const billNumber = `BILL-${String(count + 1).padStart(6, "0")}`;

  const bill = await prisma.$transaction(async (tx) => {
    const createPayload: Record<string, unknown> = {
      tenantId,
      billNumber,
      shiftId,
      warehouseId,
      stockLocationId,
      offlineId,
      countryCode,
      currency,
      customerId,
      customerName,
      customerPhone,
      subtotal,
      discountTotal,
      taxAmount,
      taxRate: billTaxRate,
      total,
      paymentMethod,
      paymentStatus: status === "HELD" ? "HELD" : "PAID",
      status,
      notes,
      billedBy: userId,
      items: { create: billItems as unknown as Record<string, unknown>[] },
    };
    const created = await tx.bill.create({ data: createPayload as never, include: { items: true } });

    if (shiftId && status === "COMPLETED") {
      await tx.cashShiftEntry.create({
        data: { tenantId, shiftId, type: "BILL_PAYMENT", amount: total, reference: created.id, notes: `Bill ${billNumber}` },
      });
    }
    return created;
  });

  // Deduct stock atomically + idempotently (all lines incl variants). On failure we
  // DO NOT silently proceed: the caller surfaces the warning / conflict.
  let stockWarning: string | undefined;
  if (status === "COMPLETED") {
    const deductRes = await serviceClient
      .call<{ error?: string }>("inventory", "/api/stock/deduct", {
        method: "POST",
        tenantId,
        userId,
        body: {
          items: billItems.map((item) => ({
            productId: item.productId,
            warehouseId,
            variantId: item.variantId ?? undefined,
            quantity: item.quantity,
          })),
          reference: bill.id,
          idempotencyKey: `BILL-DEDUCT-${bill.id}`,
          notes: `POS bill ${billNumber}`,
        },
      })
      .catch((err) => ({ status: 0, error: err instanceof Error ? err.message : "deduct call failed", data: undefined }));

    if (deductRes.status < 200 || deductRes.status >= 300) {
      stockWarning = deductRes.error ?? `Stock deduction failed (status ${deductRes.status})`;
      console.warn("pos_bill_stock_deduct_failed", { billId: bill.id, billNumber, warning: stockWarning });
    }
  }

  return { status: 201, data: bill, stockWarning };
}
