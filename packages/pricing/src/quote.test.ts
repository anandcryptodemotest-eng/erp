import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PricingBasis, quotePrice } from "./index";

describe("quotePrice PER_AREA plywood", () => {
  it("8x4 at ₹50/sqft × 2 sheets → unit 1600, resolvedQty 64, line 3200", () => {
    const { quote, snapshot } = quotePrice({
      tenantId: "t1",
      currency: "INR",
      at: new Date("2026-01-01"),
      product: {
        id: "p1",
        pricingBasis: PricingBasis.PER_AREA,
        baseRate: 50,
        pricingUom: "sq_ft",
      },
      attributes: { size: "8x4" },
      attributeDefs: [
        {
          key: "size",
          measureRole: "LENGTH",
          measureUnit: "ft",
          sizePattern: "{L}x{W}",
        },
      ],
      quantity: 2,
      pricingRuleVersion: 1,
    });

    assert.equal(quote.measure.area, 32);
    assert.equal(quote.unitPrice, 1600);
    assert.equal(quote.resolvedQuantity, 64);
    assert.equal(quote.lineTotal, 3200);
    assert.equal(quote.basis, PricingBasis.PER_AREA);
    assert.equal(snapshot.engineVersion, "1.0.0");
    assert.equal(snapshot.strategy, PricingBasis.PER_AREA);
    assert.ok(snapshot.breakdown.some((s) => s.code === "AREA"));
    assert.ok(snapshot.breakdown.some((s) => s.code === "RATE"));
  });

  it("price list overrides baseRate", () => {
    const { quote } = quotePrice({
      tenantId: "t1",
      currency: "INR",
      at: new Date(),
      product: {
        id: "p1",
        pricingBasis: PricingBasis.PER_AREA,
        baseRate: 50,
        pricingUom: "sq_ft",
      },
      attributes: { size: "8x4" },
      attributeDefs: [{ key: "size", measureRole: "LENGTH", measureUnit: "ft", sizePattern: "{L}x{W}" }],
      quantity: 1,
      priceListItems: [{ productId: "p1", minQty: 1, price: 40 }],
    });
    assert.equal(quote.rate.source, "price_list");
    assert.equal(quote.unitPrice, 1280);
  });

  it("PER_EACH uses sellPrice", () => {
    const { quote } = quotePrice({
      tenantId: "t1",
      currency: "INR",
      at: new Date(),
      product: {
        id: "p1",
        pricingBasis: PricingBasis.PER_EACH,
        sellPrice: 100,
      },
      attributes: {},
      attributeDefs: [],
      quantity: 3,
    });
    assert.equal(quote.unitPrice, 100);
    assert.equal(quote.lineTotal, 300);
    assert.equal(quote.resolvedQuantity, 3);
  });
});
