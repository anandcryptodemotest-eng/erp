import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createBill } from "@/lib/create-bill";

const lineSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  productName: z.string().min(1),
  sku: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxCode: z.string().optional(),
  taxRate: z.number().min(0).optional(),
});

const offlineBillSchema = z.object({
  offlineId: z.string().min(1), // client-generated, globally unique on the device
  warehouseId: z.string(),
  stockLocationId: z.string().optional(),
  shiftId: z.string().optional(),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "WALLET", "SPLIT"]).default("CASH"),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineSchema).min(1),
});

const syncSchema = z.object({ bills: z.array(offlineBillSchema).min(1).max(200) });

/**
 * POST /api/bills/sync — reconcile a batch of bills captured OFFLINE on a cart
 * terminal (P5 / G7).
 *
 * Each queued bill carries a client `offlineId`. Processing is idempotent: a bill
 * whose offlineId already exists is reported as `duplicate` (safe to replay the
 * whole batch). Creation reuses the SAME atomic/idempotent online path, so if stock
 * has changed on the server since the offline sale, the deduction surfaces as a
 * `conflict` for that bill (optimistic oversell, reconciled here) rather than a
 * silent oversell — the other bills in the batch still sync.
 */
export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const parsed = syncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const results: {
    offlineId: string;
    result: "synced" | "duplicate" | "conflict" | "error";
    billId?: string;
    billNumber?: string;
    detail?: string;
  }[] = [];

  for (const b of parsed.data.bills) {
    // Dedupe: already synced?
    const existing = await prisma.bill.findFirst({
      where: { tenantId, offlineId: b.offlineId },
      select: { id: true, billNumber: true },
    });
    if (existing) {
      results.push({ offlineId: b.offlineId, result: "duplicate", billId: existing.id, billNumber: existing.billNumber });
      continue;
    }

    try {
      const created = await createBill(tenantId, userId, {
        warehouseId: b.warehouseId,
        stockLocationId: b.stockLocationId,
        offlineId: b.offlineId,
        shiftId: b.shiftId,
        paymentMethod: b.paymentMethod,
        status: "COMPLETED",
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        notes: b.notes,
        items: b.items,
      });

      if (created.status >= 400) {
        // e.g. tax not approved — a genuine conflict for this bill; keep going.
        results.push({ offlineId: b.offlineId, result: "conflict", detail: created.error });
        continue;
      }

      const bill = created.data as { id: string; billNumber: string };
      if (created.stockWarning) {
        // Bill recorded, but stock could not be (fully) deducted on the server. Park
        // it as HELD so it is NOT counted as live revenue in the per-cart report; the
        // operator resolves the conflict (restock / cancel) before it settles.
        await prisma.bill.update({ where: { id: bill.id }, data: { status: "HELD", paymentStatus: "HELD" } });
        results.push({
          offlineId: b.offlineId,
          result: "conflict",
          billId: bill.id,
          billNumber: bill.billNumber,
          detail: created.stockWarning,
        });
      } else {
        results.push({ offlineId: b.offlineId, result: "synced", billId: bill.id, billNumber: bill.billNumber });
      }
    } catch (err) {
      // A unique-constraint race on offlineId means another sync won — treat as duplicate.
      if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
        const dup = await prisma.bill.findFirst({ where: { tenantId, offlineId: b.offlineId }, select: { id: true, billNumber: true } });
        results.push({ offlineId: b.offlineId, result: "duplicate", billId: dup?.id, billNumber: dup?.billNumber });
      } else {
        results.push({ offlineId: b.offlineId, result: "error", detail: err instanceof Error ? err.message : "sync failed" });
      }
    }
  }

  const summary = results.reduce(
    (acc, r) => ({ ...acc, [r.result]: (acc[r.result] ?? 0) + 1 }),
    {} as Record<string, number>
  );

  return NextResponse.json({ data: { results, summary } }, { status: 200 });
}
