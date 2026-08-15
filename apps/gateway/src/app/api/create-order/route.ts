import { NextResponse } from "next/server";
import { z } from "zod";
import { createLogger } from "@erp/logger";
import { requireTenantAdmin } from "@/lib/billing-auth";
import { prisma } from "@/lib/prisma";
import { assertAmountPaise, getRazorpayClient, getRazorpayKeyId } from "@/lib/razorpay";

const log = createLogger({ service: "gateway-razorpay" });

const bodySchema = z.object({
  /** Preferred: open BillingInvoice — amount and notes come from the invoice. */
  billingInvoiceId: z.string().min(1).optional(),
  amount: z.number().int().optional(),
  currency: z.string().min(3).max(3).default("INR"),
  receipt: z.string().max(40).optional(),
});

/** POST /api/create-order — Razorpay Standard Checkout order (SaaS billing, not dealer AR). */
export async function POST(request: Request) {
  const auth = await requireTenantAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid body" }, { status: 400 });
    }

    let amount = parsed.data.amount ?? 10_000;
    let currency = parsed.data.currency;
    let billingInvoiceId = parsed.data.billingInvoiceId;
    let receipt = parsed.data.receipt;

    if (billingInvoiceId) {
      const invoice = await prisma.billingInvoice.findFirst({
        where: { id: billingInvoiceId, tenantId: auth.tenantId },
      });
      if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      if (invoice.status !== "OPEN" && invoice.status !== "OVERDUE") {
        return NextResponse.json({ error: `Invoice is ${invoice.status}` }, { status: 409 });
      }
      amount = invoice.totalPaise;
      currency = invoice.currency || "INR";
      receipt =
        receipt ??
        `saas_${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`.slice(0, 40);
    }

    const amountError = assertAmountPaise(amount);
    if (amountError) return NextResponse.json({ error: amountError }, { status: 400 });

    if (!receipt) {
      receipt =
        `saas_${auth.tenantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}_${Date.now()}`.slice(0, 40);
    }

    const notes: Record<string, string> = {
      tenantId: auth.tenantId,
      purpose: "SAAS",
    };
    if (billingInvoiceId) notes.billingInvoiceId = billingInvoiceId;

    const order = await getRazorpayClient().orders.create({
      amount,
      currency,
      receipt,
      notes,
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: getRazorpayKeyId(),
      billingInvoiceId: billingInvoiceId ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay order failed";
    const status = /authentication|invalid key|unauthorized/i.test(message) ? 401 : 500;
    log.error("razorpay_create_order_failed", { err, tenantId: auth.tenantId });
    return NextResponse.json({ error: message }, { status });
  }
}
