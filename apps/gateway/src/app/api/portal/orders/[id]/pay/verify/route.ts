import { NextResponse } from "next/server";
import { portalSales, resolvePortalTenantId } from "@/lib/portal-upstream";
import { verifyCheckoutSignature } from "@/lib/razorpay";

type Ctx = { params: Promise<{ id: string }> };

function pspConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());
}

/**
 * POST /api/portal/orders/:id/pay/verify — complete an online payment.
 *
 * LIVE: verify the Razorpay Checkout signature HMAC(order_id|payment_id) here,
 * then ask sales to settle only if valid. DEV: no signature to check; sales
 * settles the simulated attempt.
 */
export async function POST(request: Request, { params }: Ctx) {
  const tenantId = await resolvePortalTenantId(request);
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Sign in to complete payment" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    providerOrderId?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  const providerOrderId = body.providerOrderId ?? body.razorpay_order_id;
  if (!providerOrderId) {
    return NextResponse.json({ error: "providerOrderId is required" }, { status: 400 });
  }

  let verified = true;
  if (pspConfigured()) {
    verified = verifyCheckoutSignature({
      orderId: body.razorpay_order_id ?? providerOrderId,
      paymentId: body.razorpay_payment_id ?? "",
      signature: body.razorpay_signature ?? "",
    });
    if (!verified) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }
  }

  const settled = await portalSales<{ data?: unknown; error?: string }>(
    tenantId,
    `/api/orders/${encodeURIComponent(id)}/payment/verify`,
    {
      method: "POST",
      headers: { "x-user-id": userId },
      body: JSON.stringify({
        providerOrderId,
        providerPaymentId: body.razorpay_payment_id,
        signature: body.razorpay_signature,
        verified,
      }),
    }
  );
  if (settled.status >= 400) {
    return NextResponse.json({ error: settled.json?.error ?? "Payment settlement failed" }, { status: settled.status });
  }
  return NextResponse.json(settled.json, { status: 200 });
}
