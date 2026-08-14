import { NextResponse } from "next/server";
import { z } from "zod";
import { extractToken, verifyToken } from "@erp/auth";
import { createLogger } from "@erp/logger";
import { verifyCheckoutSignature } from "@/lib/razorpay";

const log = createLogger({ service: "gateway-razorpay" });

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/** POST /api/verify-payment — HMAC-SHA256(order_id|payment_id, KEY_SECRET). Does not write dealer invoices. */
export async function POST(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature" }, { status: 400 });
  }

  const ok = verifyCheckoutSignature({
    orderId: parsed.data.razorpay_order_id,
    paymentId: parsed.data.razorpay_payment_id,
    signature: parsed.data.razorpay_signature,
  });

  if (!ok) {
    log.warn("razorpay_signature_mismatch", { tenantId: auth.tenantId, orderId: parsed.data.razorpay_order_id });
    return NextResponse.json({ error: "Signature mismatch", verified: false }, { status: 400 });
  }

  return NextResponse.json({
    verified: true,
    razorpay_order_id: parsed.data.razorpay_order_id,
    razorpay_payment_id: parsed.data.razorpay_payment_id,
  });
}
