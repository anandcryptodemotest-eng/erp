import { createLogger } from "@erp/logger";
import { serviceClient } from "@erp/config";
import { prisma } from "@/lib/prisma";
import { notifyPortalCustomer } from "@/lib/notify-customer";

const log = createLogger({ service: "sales-payment" });

/**
 * Online order payment. Two modes:
 *  - LIVE: a PSP (Razorpay) order is created by the gateway (which holds the SDK
 *    + keys); its order id is passed in here. Verification checks the PSP
 *    signature (done in the gateway) before we settle.
 *  - DEV:  no PSP keys configured → we simulate a provider order so the prepaid
 *    flow is demoable end to end. The "payment id"/"signature" are synthesized
 *    and auto-accepted on verify.
 *
 * Either way we persist an OrderPayment, and on success set
 * SalesOrder.paymentStatus = PAID and record the payment against the order's
 * invoice (if one already exists).
 */

export class OrderPaymentError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OrderPaymentError";
    this.status = status;
  }
}

function isPspConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());
}

/** Amount owed on the order (total minus anything already paid). */
async function amountDue(tenantId: string, order: { id: string; total: number }): Promise<number> {
  const paid = await prisma.orderPayment.aggregate({
    where: { tenantId, salesOrderId: order.id, status: "PAID" },
    _sum: { amount: true },
  });
  return Number(Math.max(0, order.total - (paid._sum.amount ?? 0)).toFixed(2));
}

export type CreatePaymentResult = {
  paymentId: string;
  provider: "RAZORPAY" | "DEV";
  providerOrderId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  keyId: string | null;
  devMode: boolean;
};

/**
 * Create a payment intent for an order. In LIVE mode the caller (gateway) must
 * have already created the Razorpay order and pass its id via `providerOrderId`.
 */
export async function createOrderPayment(input: {
  tenantId: string;
  salesOrderId: string;
  method?: string;
  providerOrderId?: string; // supplied by gateway in LIVE mode
}): Promise<CreatePaymentResult> {
  const order = await prisma.salesOrder.findFirst({
    where: { id: input.salesOrderId, tenantId: input.tenantId },
    select: { id: true, total: true, paymentStatus: true },
  });
  if (!order) throw new OrderPaymentError("Order not found", 404);
  if (order.paymentStatus === "PAID") throw new OrderPaymentError("Order is already paid", 409);

  const due = await amountDue(input.tenantId, order);
  if (due <= 0) throw new OrderPaymentError("Nothing due on this order", 409);

  const devMode = !isPspConfigured();
  const provider: "RAZORPAY" | "DEV" = devMode ? "DEV" : "RAZORPAY";
  const providerOrderId =
    input.providerOrderId ?? `dev_order_${input.salesOrderId}_${Date.now()}`;

  const payment = await prisma.orderPayment.create({
    data: {
      tenantId: input.tenantId,
      salesOrderId: input.salesOrderId,
      amount: due,
      currency: "INR",
      method: (input.method ?? "UPI").toUpperCase(),
      provider,
      status: "CREATED",
      providerOrderId,
    },
  });

  return {
    paymentId: payment.id,
    provider,
    providerOrderId,
    amount: due,
    amountPaise: Math.round(due * 100),
    currency: "INR",
    keyId: devMode ? null : process.env.RAZORPAY_KEY_ID?.trim() ?? null,
    devMode,
  };
}

/**
 * Settle a payment. In LIVE mode `verified` must be true (the gateway verified
 * the Razorpay signature). In DEV mode verification is implicit. Marks the
 * OrderPayment PAID, sets SalesOrder.paymentStatus=PAID, and records the payment
 * against the order's invoice if one exists.
 */
export async function settleOrderPayment(input: {
  tenantId: string;
  salesOrderId: string;
  providerOrderId: string;
  providerPaymentId?: string;
  signature?: string;
  verified: boolean;
  actorUserId?: string;
}): Promise<{ paymentStatus: string; paymentId: string }> {
  const payment = await prisma.orderPayment.findFirst({
    where: { tenantId: input.tenantId, salesOrderId: input.salesOrderId, providerOrderId: input.providerOrderId },
  });
  if (!payment) throw new OrderPaymentError("Payment attempt not found", 404);
  if (payment.status === "PAID") {
    return { paymentStatus: "PAID", paymentId: payment.id };
  }

  if (payment.provider === "RAZORPAY" && !input.verified) {
    await prisma.orderPayment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    throw new OrderPaymentError("Payment signature verification failed", 400);
  }

  await prisma.orderPayment.update({
    where: { id: payment.id },
    data: {
      status: "PAID",
      providerPaymentId: input.providerPaymentId ?? `dev_pay_${Date.now()}`,
      signature: input.signature,
    },
  });

  const order = await prisma.salesOrder.update({
    where: { id: input.salesOrderId },
    data: { paymentStatus: "PAID", paymentMethod: payment.method },
    select: { id: true, orderNumber: true, customer: { select: { portalUserId: true, phone: true } } },
  });

  // If an invoice already exists for this order, record the payment there too so
  // AR stays consistent. Best-effort — the workflow's PAYMENT_COLLECTION step
  // also reconciles later.
  try {
    const invRes = await serviceClient.call<{ data?: { id: string; status: string }[] }>(
      "accounting",
      `/api/invoices?sourceRef=${encodeURIComponent(input.salesOrderId)}&limit=1`,
      { method: "GET", tenantId: input.tenantId, userId: input.actorUserId }
    );
    const invoice = invRes.data?.data?.[0];
    if (invoice && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) {
      await serviceClient.call("accounting", `/api/invoices/${invoice.id}?action=pay`, {
        method: "PATCH",
        tenantId: input.tenantId,
        userId: input.actorUserId,
        body: {
          amount: payment.amount,
          method: "UPI",
          reference: payment.providerPaymentId ?? payment.providerOrderId,
          date: new Date().toISOString(),
        },
      });
    }
  } catch (err) {
    log.warn("order_payment_invoice_record_failed", { salesOrderId: input.salesOrderId, err });
  }

  await notifyPortalCustomer({
    tenantId: input.tenantId,
    portalUserId: order.customer.portalUserId,
    phone: order.customer.phone,
    type: "ORDER_PAID",
    title: "Payment received",
    body: `We've received your payment for order ${order.orderNumber}. Thank you!`,
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
  });

  log.info("order_payment_settled", {
    tenantId: input.tenantId,
    salesOrderId: input.salesOrderId,
    provider: payment.provider,
    amount: payment.amount,
  });

  return { paymentStatus: "PAID", paymentId: payment.id };
}
