import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createBill } from "@/lib/create-bill";

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
  /** Optional cart / stock-location this sale came from (per-cart reporting). */
  stockLocationId: z.string().optional(),
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
    prisma.bill.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, include: { items: true } }),
    prisma.bill.count({ where }),
  ]);

  return NextResponse.json({ data: bills, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/bills — create a POS bill (delegates to the shared createBill core).
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

  const result = await createBill(tenantId, userId, parsed.data, {
    countryCodeHeader: request.headers.get("x-country-code") ?? undefined,
    currencyHeader: request.headers.get("x-currency") ?? undefined,
  });
  if (result.status >= 400) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    { data: result.data, ...(result.stockWarning ? { stockWarning: result.stockWarning } : {}) },
    { status: result.status }
  );
}
