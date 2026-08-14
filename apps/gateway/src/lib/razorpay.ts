import crypto from "node:crypto";
import Razorpay from "razorpay";

const MIN_AMOUNT_PAISE = 100;

export function getRazorpayKeyId(): string {
  const id = process.env.RAZORPAY_KEY_ID?.trim() || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
  if (!id) throw new Error("RAZORPAY_KEY_ID is not configured");
  return id;
}

export function getRazorpayKeySecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET is not configured");
  return secret;
}

export function getRazorpayClient(): Razorpay {
  return new Razorpay({
    key_id: getRazorpayKeyId(),
    key_secret: getRazorpayKeySecret(),
  });
}

export function assertAmountPaise(amount: number): string | null {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    return "amount must be an integer (paise)";
  }
  if (amount < MIN_AMOUNT_PAISE) {
    return `amount must be at least ${MIN_AMOUNT_PAISE} paise`;
  }
  return null;
}

function hmacHexEqual(secret: string, payload: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Standard Checkout success verification: HMAC-SHA256(order_id|payment_id, KEY_SECRET) */
export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  return hmacHexEqual(getRazorpayKeySecret(), `${input.orderId}|${input.paymentId}`, input.signature);
}

/** Subscription Checkout first payment: HMAC-SHA256(payment_id|subscription_id, KEY_SECRET) */
export function verifySubscriptionCheckoutSignature(input: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}): boolean {
  return hmacHexEqual(getRazorpayKeySecret(), `${input.paymentId}|${input.subscriptionId}`, input.signature);
}

/** Webhook HMAC on the raw request body. Uses RAZORPAY_WEBHOOK_SECRET only (not KEY_SECRET). */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secretOverride?: string | null
): boolean {
  const secret = secretOverride?.trim() || process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret || !signatureHeader) return false;
  return hmacHexEqual(secret, rawBody, signatureHeader);
}

export { MIN_AMOUNT_PAISE };
