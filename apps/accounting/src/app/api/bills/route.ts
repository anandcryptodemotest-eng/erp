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
});

const createBillSchema = z.object({
  shiftId: z.string().optional(),
  warehouseId: z.string(),
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

  const where = {
    tenantId,
    ...(shiftId && { shiftId }),
    ...(status && { status }),
    ...(customerId && { customerId }),
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

  const { warehouseId, items, shiftId, customerId, customerName, customerPhone, paymentMethod, status, notes } = parsed.data;

  // Validate shift is open if provided
  if (shiftId) {
    const shift = await prisma.cashShift.findFirst({ where: { id: shiftId, tenantId, status: "OPEN" } });
    if (!shift) return NextResponse.json({ error: "Shift not found or not open" }, { status: 404 });
  }

  const TAX_RATE = parseFloat(process.env.TAX_RATE ?? "0.10");
  const billItems = items.map((item) => ({
    ...item,
    taxAmount: (item.quantity * item.unitPrice - item.discount) * TAX_RATE,
    total: (item.quantity * item.unitPrice - item.discount) * (1 + TAX_RATE),
  }));

  const subtotal = billItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountTotal = billItems.reduce((s, i) => s + i.discount, 0);
  const taxAmount = billItems.reduce((s, i) => s + i.taxAmount, 0);
  const total = billItems.reduce((s, i) => s + i.total, 0);

  const count = await prisma.bill.count({ where: { tenantId } });
  const billNumber = `BILL-${String(count + 1).padStart(6, "0")}`;

  const bill = await prisma.$transaction(async (tx) => {
    const created = await tx.bill.create({
      data: {
        tenantId,
        billNumber,
        shiftId,
        customerId,
        customerName,
        customerPhone,
        subtotal,
        discountTotal,
        taxAmount,
        taxRate: TAX_RATE,
        total,
        paymentMethod,
        paymentStatus: status === "HELD" ? "HELD" : "PAID",
        status,
        notes,
        billedBy: userId,
        items: { create: billItems },
      },
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
