import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrderPayment, OrderPaymentError } from "@/lib/order-payment";

const createSchema = z.object({
  method: z.string().optional(),
  /** Supplied by the gateway in LIVE mode (Razorpay order id). */
  providerOrderId: z.string().optional(),
});

// POST /api/orders/:id/payment — create a payment intent for an online order.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const data = createSchema.parse(body);
    const result = await createOrderPayment({
      tenantId,
      salesOrderId: id,
      method: data.method,
      providerOrderId: data.providerOrderId,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderPaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
