import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUpiPayUri, invoicePaymentPayload, isValidVpa } from "./upi-pay-uri";

test("isValidVpa", () => {
  assert.equal(isValidVpa("shop@upi"), true);
  assert.equal(isValidVpa("trustwood-enterprise@okhdfcbank"), true);
  assert.equal(isValidVpa("bad"), false);
  assert.equal(isValidVpa("@upi"), false);
  assert.equal(isValidVpa(""), false);
});

test("buildUpiPayUri includes pa pn am cu tn", () => {
  const uri = buildUpiPayUri({
    vpa: "shop@upi",
    payeeName: "Trustwood",
    amount: 12500.5,
    tn: "INV-1",
  });
  assert.match(uri, /^upi:\/\/pay\?/);
  assert.match(uri, /pa=shop%40upi/);
  assert.match(uri, /pn=Trustwood/);
  assert.match(uri, /am=12500\.50/);
  assert.match(uri, /cu=INR/);
  assert.match(uri, /tn=INV-1/);
});

test("invoicePaymentPayload omits URI when paid or no VPA", () => {
  assert.equal(invoicePaymentPayload({ payeeName: "A", invoiceNumber: "I", total: 100 }), undefined);
  const paid = invoicePaymentPayload({
    vpa: "shop@upi",
    payeeName: "A",
    invoiceNumber: "INV-9",
    total: 100,
    paidAmount: 100,
  });
  assert.deepEqual(paid, { vpa: "shop@upi", amountDue: 0 });
  assert.equal(paid?.upiUri, undefined);
});

test("invoicePaymentPayload produces URI when due", () => {
  const p = invoicePaymentPayload({
    vpa: "shop@upi",
    payeeName: "Trustwood",
    invoiceNumber: "INV-1",
    total: 236,
    paidAmount: 0,
  });
  assert.ok(p?.upiUri?.startsWith("upi://pay?"));
  assert.equal(p?.amountDue, 236);
  assert.equal(p?.vpa, "shop@upi");
});
