import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  action: z.enum(["cancel", "refund"]),
  reason: z.string().max(500).optional(),
  refundMethod: z.enum(["CASH", "UPI", "CARD", "WALLET"]).optional(),
});

// GET /api/bills/:id
export async function GET(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;
  const bill = await prisma.bill.findFirst({ where: { id, tenantId }, include: { items: true, returns: true } });
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  return NextResponse.json({ data: bill });
}

/**
 * PATCH /api/bills/:id — cancel or refund a POS bill.
 *
 * Reverses the stock the sale deducted: a compensating IN back to the bill's
 * warehouse (idempotent per bill via idempotencyKey BILL-REVERSE-<id>), then marks
 * the bill CANCELLED / REFUNDED and records a negative cash-shift entry so the
 * per-tender reconciliation nets the reversal. Only a COMPLETED bill can be
 * reversed, and only once.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id") ?? "SYSTEM";
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role && !["ADMIN", "MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  const { id } = await params;

  try {
    const data = patchSchema.parse(await request.json());
    const bill = await prisma.bill.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

    if (bill.status !== "COMPLETED" || bill.paymentStatus === "CANCELLED" || bill.paymentStatus === "REFUNDED") {
      return NextResponse.json({ error: `Bill is not reversible (status ${bill.status}/${bill.paymentStatus})` }, { status: 409 });
    }

    // 1. Reverse stock: compensating IN back to the warehouse the sale deducted from.
    //    Idempotent per bill so a retried cancel/refund never double-restocks.
    let stockWarning: string | undefined;
    if (bill.warehouseId && bill.items.length) {
      const recv = await serviceClient
        .call<{ error?: string }>("inventory", "/api/stock/receive", {
          method: "POST",
          tenantId,
          userId,
          body: {
            reference: `REVERSE-${bill.id}`,
            idempotencyKey: `BILL-REVERSE-${bill.id}`,
            notes: `Reversal of bill ${bill.billNumber} (${data.action})`,
            items: bill.items.map((it) => ({
              productId: it.productId,
              warehouseId: bill.warehouseId as string,
              variantId: it.variantId ?? undefined,
              quantity: it.quantity,
            })),
          },
        })
        .catch((err) => ({ status: 0, error: err instanceof Error ? err.message : "reverse failed", data: undefined }));
      if (recv.status < 200 || recv.status >= 300) {
        stockWarning = recv.error ?? `Stock reversal failed (status ${recv.status})`;
        console.warn("bill_reverse_stock_failed", { billId: bill.id, warning: stockWarning });
      }
    }

    // 2. Mark the bill + record the financial reversal.
    const newPaymentStatus = data.action === "refund" ? "REFUNDED" : "CANCELLED";
    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.bill.update({
        where: { id },
        data: { status: "CANCELLED", paymentStatus: newPaymentStatus, notes: data.reason ?? bill.notes },
        include: { items: true },
      });

      // Negative cash-shift entry so per-tender reconciliation nets the reversal.
      if (bill.shiftId) {
        await tx.cashShiftEntry.create({
          data: {
            tenantId,
            shiftId: bill.shiftId,
            type: data.action === "refund" ? "REFUND" : "BILL_CANCELLED",
            amount: -bill.total,
            reference: bill.id,
            notes: `${data.action === "refund" ? "Refund" : "Cancellation"} of bill ${bill.billNumber}`,
          },
        });
      }

      await tx.billReturn.create({
        data: {
          tenantId,
          billId: bill.id,
          reason: data.reason,
          totalRefund: bill.total,
          refundMethod: data.refundMethod ?? bill.paymentMethod,
          processedBy: userId,
        },
      });
      return b;
    });

    return NextResponse.json({ data: updated, ...(stockWarning ? { stockWarning } : {}) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
