import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  billingPeriodKey,
  computeEntitlement,
  FREE_FEATURES,
  hasFeature,
  mergePlanFeatureCodes,
  periodLengthDays,
  ymd,
} from "./billing-core";

describe("computeEntitlement", () => {
  const now = new Date("2026-08-13T12:00:00.000Z");
  const paid = ["dashboard", "organization", "users", "oms", "inventory"];

  it("treats no subscription as Free, not all features", () => {
    const r = computeEntitlement({ subscription: null, graceDays: 3, now });
    assert.equal(r.licensed, true);
    assert.deepEqual(r.features, [...FREE_FEATURES]);
    assert.equal(r.reason, "free_fallback");
    assert.equal(hasFeature(r, "oms"), false);
    assert.equal(hasFeature(r, "dashboard"), true);
  });

  it("keeps INITIATED on Free features", () => {
    const r = computeEntitlement({
      subscription: { status: "INITIATED", currentPeriodEnd: null, featureCodes: paid },
      graceDays: 3,
      now,
    });
    assert.equal(r.licensed, true);
    assert.equal(hasFeature(r, "oms"), false);
  });

  it("licenses ACTIVE with snapshotted paid features", () => {
    const r = computeEntitlement({
      subscription: {
        status: "ACTIVE",
        currentPeriodEnd: addDays(now, 20),
        featureCodes: paid,
        planCode: "growth_monthly",
      },
      graceDays: 3,
      now,
    });
    assert.equal(r.licensed, true);
    assert.equal(hasFeature(r, "oms"), true);
    assert.equal(hasFeature(r, "quick_bill"), false);
  });

  it("licenses PAST_DUE inside grace", () => {
    const r = computeEntitlement({
      subscription: { status: "PAST_DUE", currentPeriodEnd: addDays(now, -1), featureCodes: paid },
      graceDays: 3,
      now,
    });
    assert.equal(r.reason, "grace");
    assert.equal(r.licensed, true);
    assert.equal(hasFeature(r, "oms"), true);
  });

  it("falls back to Free after grace", () => {
    const r = computeEntitlement({
      subscription: { status: "PAST_DUE", currentPeriodEnd: addDays(now, -4), featureCodes: paid },
      graceDays: 3,
      now,
    });
    assert.equal(r.licensed, true);
    assert.equal(hasFeature(r, "oms"), false);
    assert.equal(hasFeature(r, "dashboard"), true);
  });
});

describe("billingPeriodKey", () => {
  it("is stable for a calendar span", () => {
    const start = new Date("2026-08-13T00:00:00.000Z");
    const end = new Date("2026-09-12T00:00:00.000Z");
    assert.equal(billingPeriodKey("MONTHLY", start, end), `${ymd(start)}_${ymd(end)}`);
  });

  it("prefixes plan code when provided", () => {
    const start = new Date("2026-08-13T00:00:00.000Z");
    const end = new Date("2026-09-12T00:00:00.000Z");
    assert.equal(
      billingPeriodKey("MONTHLY", start, end, "growth_monthly"),
      `growth_monthly:${ymd(start)}_${ymd(end)}`
    );
  });

  it("uses ONCE_ prefix for one-time plans", () => {
    const start = new Date("2026-08-13T00:00:00.000Z");
    assert.equal(billingPeriodKey("ONCE", start, start), "ONCE_2026-08-13");
  });
});

describe("periodLengthDays", () => {
  it("supports weekly, quarterly, yearly, and once cycles", () => {
    assert.equal(periodLengthDays("WEEKLY"), 7);
    assert.equal(periodLengthDays("MONTHLY"), 30);
    assert.equal(periodLengthDays("QUARTERLY"), 90);
    assert.equal(periodLengthDays("YEARLY"), 365);
    assert.equal(periodLengthDays("ONCE"), 0);
  });
});

describe("mergePlanFeatureCodes", () => {
  it("always includes Free core features", () => {
    assert.deepEqual(mergePlanFeatureCodes(["oms"]), [...FREE_FEATURES, "oms"]);
    assert.deepEqual(mergePlanFeatureCodes([...FREE_FEATURES, "oms"]), [...FREE_FEATURES, "oms"]);
  });
});
