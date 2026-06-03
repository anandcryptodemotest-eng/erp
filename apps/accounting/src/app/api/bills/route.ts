import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";

const billItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  productName: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxCode: z.string().optional(),
  taxRate: z.number().min(0).optional(),
});

const createBillSchema = z.object({
  shiftId: z.string().optional(),
  warehouseId: z.string(),
  countryCode: z.string().length(2).optional(),
  currency: z.string().min(3).max(3).optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "WALLET", "SPLIT"]).default("CASH"),
  status: z.enum(["COMPLETED", "HELD"]).default("COMPLETED"),
  notes: z.string().optional(),
  items: z.array(billItemSchema).min(1),
});

function normalizeRate(rate: number): number {
  if (Number.isNaN(rate) || rate < 0) return 0;
  return rate > 1 ? rate / 100 : rate;
}

// GET /api/bills
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const shiftId = url.searchParams.get("shiftId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const billNumber = url.searchParams.get("billNumber") ?? undefined;
  const customerPhone = url.searchParams.get("customerPhone") ?? undefined;

  const where = {
    tenantId,
    ...(shiftId && { shiftId }),
    ...(status && { status }),
    ...(customerId && { customerId }),
    ...(billNumber && { billNumber }),
    ...(customerPhone && { customerPhone }),
  };

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { items: true },
    }),
    prisma.bill.count({ where }),
  ]);

  return NextResponse.json({ data: bills, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/bills — create a POS bill
export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createBillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const {
    warehouseId,
    items,
    shiftId,
    countryCode: requestedCountryCode,
    currency: requestedCurrency,
    customerId,
    customerName,
    customerPhone,
    paymentMethod,
    status,
    notes,
  } = parsed.data;

  const countryCode = (requestedCountryCode ?? request.headers.get("x-country-code") ?? "IN").toUpperCase();
  const currency = (requestedCurrency ?? request.headers.get("x-currency") ?? (countryCode === "IN" ? "INR" : "USD")).toUpperCase();

  // Validate shift is open if provided
  if (shiftId) {
    const shift = await prisma.cashShift.findFirst({ where: { id: shiftId, tenantId, status: "OPEN" } });
    if (!shift) return NextResponse.json({ error: "Shift not found or not open" }, { status: 404 });
  }

  const activeTaxRates = await prisma.taxRate.findMany({
    where: {
      tenantId,
      countryCode,
      isActive: true,
    },
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
      }>(
        "inventory",
        `/api/products/${productId}`,
        { method: "GET", tenantId, userId }
      );

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
    return NextResponse.json(
      {
        error: `Tax not approved for products: ${Array.from(new Set(blockedProducts)).join(", ")}. Review HSN/tax approval before billing.`,
      },
      { status: 409 }
    );
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

    const created = await tx.bill.create({
      data: createPayload as never,
      include: { items: true },
    });

    // Record cash payment in shift
    if (shiftId && status === "COMPLETED") {
      await tx.cashShiftEntry.create({
        data: {
          tenantId,
          shiftId,
          type: "BILL_PAYMENT",
          amount: total,
          reference: created.id,
          notes: `Bill ${billNumber}`,
        },
      });
    }

    return created;
  });

  // Deduct stock via inventory service (fire-and-continue; don't block the bill)
  if (status === "COMPLETED") {
    for (const item of billItems) {
      if (!item.variantId) {
        await serviceClient.call("inventory", "/api/stock/deduct", {
          method: "POST",
          body: { productId: item.productId, warehouseId, quantity: item.quantity, reference: bill.id },
          tenantId,
          userId,
        }).catch(() => null); // log but don't fail — stock reconciliation handles discrepancies
      }
    }
  }

  return NextResponse.json({ data: bill }, { status: 201 });
}
