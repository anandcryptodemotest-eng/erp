import { NextResponse } from "next/server";
import { z } from "zod";
import { settleOrderPayment, OrderPaymentError } from "@/lib/order-payment";

const verifySchema = z.object({
  providerOrderId: z.string().min(1),
  providerPaymentId: z.string().optional(),
  signature: z.string().optional(),
  /** Set by the gateway after it verifies the Razorpay signature. DEV mode ignores it. */
  verified: z.boolean().optional(),
});

// POST /api/orders/:id/payment/verify — settle a payment (mark order PAID).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const body = await request.json();
    const data = verifySchema.parse(body);
    const result = await settleOrderPayment({
      tenantId,
      salesOrderId: id,
      providerOrderId: data.providerOrderId,
      providerPaymentId: data.providerPaymentId,
      signature: data.signature,
      verified: data.verified ?? false,
      actorUserId: userId,
    });
    return NextResponse.json({ data: result });
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
