import { NextResponse } from "next/server";
import { createLogger } from "@erp/logger";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { applyCapturedPayment, ensureBillingCatalog } from "@/lib/billing-core";

const log = createLogger({ service: "gateway-razorpay" });

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * POST /api/webhooks/razorpay — adapter only. Settles BillingInvoice when notes.purpose=SAAS.
 * Does not change subscription status except via invoice PAID apply path.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!signature || !verifyWebhookSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  let event: Record<string, unknown> = {};
  try {
    event = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof event.event === "string" ? event.event : "unknown";
  const payload = asRecord(event.payload);
  const paymentWrap = asRecord(payload?.payment);
  const payment = asRecord(paymentWrap?.entity) ?? paymentWrap;
  const notes = asRecord(payment?.notes);
  if (notes?.purpose !== "SAAS" || typeof notes.billingInvoiceId !== "string") {
    log.info("razorpay_webhook_ignored", { event: name });
    return NextResponse.json({ received: true, event: name, ignored: true });
  }

  await ensureBillingCatalog();
  const paymentId = typeof payment?.id === "string" ? payment.id : "";
  const amount = typeof payment?.amount === "number" ? payment.amount : 0;
  const tenantId = typeof notes.tenantId === "string" ? notes.tenantId : "";
  if (!paymentId || !tenantId) {
    return NextResponse.json({ received: true, event: name, ignored: true });
  }

  const result = await applyCapturedPayment({
    invoiceId: notes.billingInvoiceId,
    tenantId,
    amountPaise: amount,
    provider: "RAZORPAY",
    providerPaymentId: paymentId,
    providerOrderId: typeof payment?.order_id === "string" ? payment.order_id : undefined,
    providerEventId: typeof event.event === "string" ? `${event.event}:${paymentId}` : paymentId,
  });
  log.info("razorpay_saas_payment", { event: name, ok: result.ok });
  return NextResponse.json({ received: true, event: name, ...result });
}
