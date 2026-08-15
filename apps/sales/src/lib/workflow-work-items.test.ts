import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasDispatchFulfillmentPayload,
  hasPaymentCollectionPayload,
  shouldCompleteStep,
} from "./workflow-work-item-gates";

describe("dispatch_order sequential complete", () => {
  it("skips dispatch when warehouse-only payload (no vehicle/driver)", () => {
    assert.equal(
      shouldCompleteStep("warehouse", "dispatch_order", { warehouseId: "wh-1" }),
      true
    );
    assert.equal(
      shouldCompleteStep("dispatch", "dispatch_order", { warehouseId: "wh-1" }),
      false
    );
    assert.equal(hasDispatchFulfillmentPayload({ warehouseId: "wh-1" }), false);
  });

  it("completes dispatch when own-fleet vehicle + driver present", () => {
    const payload = {
      warehouseId: "wh-1",
      fulfillmentMode: "own_fleet",
      vehicleInfo: "TN-01-AB-1234",
      assignedDriverId: "driver-1",
    };
    assert.equal(shouldCompleteStep("warehouse", "dispatch_order", payload), true);
    assert.equal(shouldCompleteStep("dispatch", "dispatch_order", payload), true);
    assert.equal(hasDispatchFulfillmentPayload(payload), true);
  });

  it("completes dispatch when Porter booking is pending or booked", () => {
    assert.equal(
      shouldCompleteStep("dispatch", "dispatch_order", {
        fulfillmentMode: "porter",
        porterBookingStatus: "BOOKING_PENDING",
      }),
      true
    );
    assert.equal(
      shouldCompleteStep("dispatch", "dispatch_order", {
        porterBookingStatus: "BOOKED",
        trackingNumber: "P-99",
      }),
      true
    );
    assert.equal(
      shouldCompleteStep("dispatch", "dispatch_order", {
        fulfillmentMode: "porter",
        porterBookingStatus: "NOT_BOOKED",
      }),
      false
    );
  });

  it("bill_and_collect gates payment on real collection fields", () => {
    assert.equal(shouldCompleteStep("invoice", "bill_and_collect", {}), true);
    assert.equal(shouldCompleteStep("payment", "bill_and_collect", {}), false);
    assert.equal(
      shouldCompleteStep("payment", "bill_and_collect", { paymentMethod: "" }),
      false
    );
    assert.equal(hasPaymentCollectionPayload({ paymentAmount: 0 }), false);
    assert.equal(
      shouldCompleteStep("payment", "bill_and_collect", { paymentMethod: "UPI" }),
      true
    );
    assert.equal(
      shouldCompleteStep("payment", "bill_and_collect", { paymentAmount: 500 }),
      true
    );
  });
});
