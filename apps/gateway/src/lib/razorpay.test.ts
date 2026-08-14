import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";

describe("verifyCheckoutSignature", () => {
  before(() => {
    process.env.RAZORPAY_KEY_SECRET = "test_key_secret";
  });

  it("accepts HMAC-SHA256(order_id|payment_id, secret)", async () => {
    const { verifyCheckoutSignature } = await import("./razorpay");
    const orderId = "order_test1";
    const paymentId = "pay_test1";
    const signature = createHmac("sha256", "test_key_secret").update(`${orderId}|${paymentId}`).digest("hex");
    assert.equal(verifyCheckoutSignature({ orderId, paymentId, signature }), true);
  });

  it("rejects a tampered signature", async () => {
    const { verifyCheckoutSignature } = await import("./razorpay");
    assert.equal(
      verifyCheckoutSignature({
        orderId: "order_test1",
        paymentId: "pay_test1",
        signature: "0".repeat(64),
      }),
      false
    );
  });
});

describe("verifySubscriptionCheckoutSignature", () => {
  it("accepts HMAC-SHA256(payment_id|subscription_id, secret)", async () => {
    process.env.RAZORPAY_KEY_SECRET = "test_key_secret";
    const { verifySubscriptionCheckoutSignature } = await import("./razorpay");
    const paymentId = "pay_sub1";
    const subscriptionId = "sub_test1";
    const signature = createHmac("sha256", "test_key_secret")
      .update(`${paymentId}|${subscriptionId}`)
      .digest("hex");
    assert.equal(verifySubscriptionCheckoutSignature({ paymentId, subscriptionId, signature }), true);
  });
});
