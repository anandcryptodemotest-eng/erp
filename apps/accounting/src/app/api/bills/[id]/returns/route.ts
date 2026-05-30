import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";

const returnItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  productName: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const createReturnSchema = z.object({
  warehouseId: z.string(),
  reason: z.string().optional(),
  refundMethod: z.enum(["CASH", "UPI", "WALLET"]).default("CASH"),
  items: z.array(returnItemSchema).min(1),
});

// GET /api/bills/:id/returns
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const bill = await prisma.bill.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  const returns = await prisma.billReturn.findMany({
    where: { billId: id, tenantId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: returns });
}

// POST /api/bills/:id/returns — process a POS return
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }
  if (!["ADMIN", "MANAGER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const bill = await prisma.bill.findFirst({ where: { id, tenantId }, include: { items: true } });
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  if (bill.status !== "COMPLETED") {
    return NextResponse.json({ error: "Can only return items from a COMPLETED bill" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createReturnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Validate quantities against bill items
  for (const rItem of parsed.data.items) {
    const billItem = bill.items.find((i) => i.productId === rItem.productId && i.variantId === (rItem.variantId ?? null));
    if (!billItem) {
      return NextResponse.json({ error: `Product ${rItem.productId} not found on bill` }, { status: 400 });
    }
    if (rItem.quantity > billItem.quantity) {
      return NextResponse.json(
        { error: `Return quantity (${rItem.quantity}) exceeds billed quantity (${billItem.quantity}) for ${rItem.productName}` },
        { status: 400 }
      );
    }
  }

  const totalRefund = parsed.data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const TAX_RATE = parseFloat(process.env.TAX_RATE ?? "0.10");
  const returnItems = parsed.data.items.map((i) => ({
    ...i,
    refundAmount: i.quantity * i.unitPrice * (1 + TAX_RATE),
  }));
  const totalRefundWithTax = returnItems.reduce((s, i) => s + i.refundAmount, 0);

  const billReturn = await prisma.$transaction(async (tx) => {
    const created = await tx.billReturn.create({
      data: {
        tenantId,
        billId: id,
        reason: parsed.data.reason,
        totalRefund: totalRefundWithTax,
        refundMethod: parsed.data.refundMethod,
        processedBy: userId,
        items: { create: returnItems },
      },
      include: { items: true },
    });

    // Record refund entry in shift if bill had a shift
    if (bill.shiftId) {
      await tx.cashShiftEntry.create({
        data: {
          tenantId,
          shiftId: bill.shiftId,
          type: "REFUND",
          amount: totalRefundWithTax,
          reference: created.id,
          notes: `Return for bill ${bill.billNumber}`,
        },
      });
    }

    // Mark bill as REFUNDED if return covers all items
    const totalBillQty = bill.items.reduce((s, i) => s + i.quantity, 0);
    if (totalRefund >= totalBillQty * (bill.total / totalBillQty)) {
      await tx.bill.update({ where: { id }, data: { paymentStatus: "REFUNDED" } });
    }

    return created;
  });

  // Restock via inventory service
  for (const item of returnItems) {
    if (!item.variantId) {
      await serviceClient.call("inventory", "/api/stock/add", {
        method: "POST",
        body: {
          productId: item.productId,
          warehouseId: parsed.data.warehouseId,
          quantity: item.quantity,
          reference: billReturn.id,
          notes: `POS return for bill ${bill.billNumber}`,
        },
        tenantId,
        userId,
      }).catch(() => null);
    }
  }

  return NextResponse.json({ data: billReturn }, { status: 201 });
}
