import { NextResponse } from "next/server";
import { portalSales, resolvePortalTenantId } from "@/lib/portal-upstream";
import { getRazorpayClient, getRazorpayKeyId } from "@/lib/razorpay";
import { createLogger } from "@erp/logger";

const log = createLogger({ service: "gateway-portal-pay" });

type Ctx = { params: Promise<{ id: string }> };

function pspConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());
}

/**
 * POST /api/portal/orders/:id/pay — begin an online payment for the buyer's order.
 *
 * LIVE (Razorpay keys set): create a Razorpay order on the amount due, then persist
 * the attempt in sales keyed by that order id. Returns keyId + providerOrderId so
 * the storefront can open Razorpay Checkout.
 * DEV (no keys): sales simulates a provider order; the client immediately calls
 * /verify to settle — no real money movement.
 */
export async function POST(request: Request, { params }: Ctx) {
  const tenantId = await resolvePortalTenantId(request);
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Sign in to pay for an order" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const method = typeof body.method === "string" ? body.method : "UPI";

  // In LIVE mode, create the Razorpay order here (gateway holds the SDK + keys),
  // using the amount-due the sales service reports.
  let providerOrderId: string | undefined;
  if (pspConfigured()) {
    const due = await portalSales<{ data?: { total: number; paymentStatus: string } }>(
      tenantId,
      `/api/orders/${encodeURIComponent(id)}`,
      { headers: { "x-user-id": userId } }
    );
    const total = due.json?.data?.total ?? 0;
    if (due.status !== 200 || total <= 0) {
      return NextResponse.json({ error: "Order not payable" }, { status: 409 });
    }
    try {
      const rzpOrder = await getRazorpayClient().orders.create({
        amount: Math.round(total * 100),
        currency: "INR",
        notes: { purpose: "ORDER", salesOrderId: id, tenantId },
      });
      providerOrderId = rzpOrder.id;
    } catch (err) {
      log.error("razorpay_order_create_failed", { tenantId, orderId: id, err });
      return NextResponse.json({ error: "Could not start payment" }, { status: 502 });
    }
  }

  // Persist the attempt in sales (which owns the order + computes amount due).
  const created = await portalSales<{ data?: unknown; error?: string }>(
    tenantId,
    `/api/orders/${encodeURIComponent(id)}/payment`,
    {
      method: "POST",
      headers: { "x-user-id": userId },
      body: JSON.stringify({ method, providerOrderId }),
    }
  );
  if (created.status >= 400) {
    return NextResponse.json({ error: created.json?.error ?? "Payment init failed" }, { status: created.status });
  }

  const data = (created.json as { data?: Record<string, unknown> }).data ?? {};
  return NextResponse.json(
    { data: { ...data, keyId: pspConfigured() ? getRazorpayKeyId() : null } },
    { status: 201 }
  );
}
