import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/billing-auth";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { applyCapturedPayment } from "@/lib/billing-core";

const bodySchema = z.object({
  invoiceId: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/** POST /api/billing/verify-payment — LIVE Checkout HMAC then allocate to BillingInvoice. */
export async function POST(request: Request) {
  const auth = await requireTenantAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing invoiceId or Razorpay checkout fields" }, { status: 400 });
  }
  const ok = verifyCheckoutSignature({
    orderId: parsed.data.razorpay_order_id,
    paymentId: parsed.data.razorpay_payment_id,
    signature: parsed.data.razorpay_signature,
  });
  if (!ok) return NextResponse.json({ error: "Signature mismatch", verified: false }, { status: 400 });

  const result = await applyCapturedPayment({
    invoiceId: parsed.data.invoiceId,
    tenantId: auth.tenantId,
    amountPaise: 0,
    provider: "RAZORPAY",
    providerPaymentId: parsed.data.razorpay_payment_id,
    providerOrderId: parsed.data.razorpay_order_id,
    providerEventId: `checkout:${parsed.data.razorpay_payment_id}`,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: { verified: true, ...result } });
}
