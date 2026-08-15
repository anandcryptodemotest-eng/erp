import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPortalPrice } from "./pricing-display";

describe("formatPortalPrice", () => {
  it("formats fixed PER_EACH price", () => {
    const r = formatPortalPrice({ sellPrice: 350, pricingBasis: "PER_EACH" });
    assert.equal(r.kind, "fixed");
    assert.equal(r.quickAdd, true);
    assert.equal(r.label, "₹350");
    assert.ok(!r.label.includes("₹0"));
  });

  it("formats PER_AREA as From rate", () => {
    const r = formatPortalPrice({
      sellPrice: null,
      baseRate: 85,
      pricingBasis: "PER_AREA",
      pricingUom: "sq_ft",
    });
    assert.equal(r.kind, "from");
    assert.equal(r.quickAdd, false);
    assert.match(r.label, /^From ₹85/);
    assert.ok(!/₹0/.test(r.label));
  });

  it("never returns ₹0 for null/zero sellPrice", () => {
    for (const input of [
      { sellPrice: 0 },
      { sellPrice: null },
      { sellPrice: undefined, baseRate: 0 },
      {},
    ]) {
      const r = formatPortalPrice(input);
      assert.ok(!/₹\s*0\b/.test(r.label), `got ${r.label}`);
      assert.equal(r.quickAdd, false);
    }
  });
});
