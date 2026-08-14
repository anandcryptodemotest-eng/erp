import { NextResponse } from "next/server";
import { z } from "zod";
import { extractToken, verifyToken } from "@erp/auth";
import { createLogger } from "@erp/logger";
import { assertAmountPaise, getRazorpayClient, getRazorpayKeyId } from "@/lib/razorpay";

const log = createLogger({ service: "gateway-razorpay" });

const bodySchema = z.object({
  amount: z.number().int().optional(),
  currency: z.string().min(3).max(3).default("INR"),
  receipt: z.string().max(40).optional(),
});

/** POST /api/create-order — Razorpay Standard Checkout order (SaaS billing, not dealer AR). */
export async function POST(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  if (!auth.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 401 });

  try {
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid body" }, { status: 400 });
    }

    const amount = parsed.data.amount ?? 10_000;
    const amountError = assertAmountPaise(amount);
    if (amountError) return NextResponse.json({ error: amountError }, { status: 400 });

    const receipt =
      parsed.data.receipt ??
      `saas_${auth.tenantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}_${Date.now()}`.slice(0, 40);

    const order = await getRazorpayClient().orders.create({
      amount,
      currency: parsed.data.currency,
      receipt,
      notes: { tenantId: auth.tenantId, purpose: "SAAS" },
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: getRazorpayKeyId(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay order failed";
    const status =
      /authentication|invalid key|unauthorized/i.test(message) ? 401 : 500;
    log.error("razorpay_create_order_failed", { err, tenantId: auth.tenantId });
    return NextResponse.json({ error: message }, { status });
  }
}
