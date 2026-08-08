import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPorterBookingEvent,
  canCompleteDispatch,
  normalizeDispatchPayload,
  parseFulfillmentMode,
  parsePorterBookingStatus,
} from "./fulfillment-dispatch";

describe("Porter booking state machine", () => {
  it("BOOK_REQUESTED: NOT_BOOKED → BOOKING_PENDING", () => {
    assert.equal(applyPorterBookingEvent("NOT_BOOKED", "BOOK_REQUESTED"), "BOOKING_PENDING");
  });

  it("BOOK_REQUESTED: CANCELLED → BOOKING_PENDING", () => {
    assert.equal(applyPorterBookingEvent("CANCELLED", "BOOK_REQUESTED"), "BOOKING_PENDING");
  });

  it("BOOK_REQUESTED does not regress BOOKED", () => {
    assert.equal(applyPorterBookingEvent("BOOKED", "BOOK_REQUESTED"), "BOOKED");
  });

  it("TRACKING_ENTERED: BOOKING_PENDING → BOOKED", () => {
    assert.equal(applyPorterBookingEvent("BOOKING_PENDING", "TRACKING_ENTERED"), "BOOKED");
  });

  it("TRACKING_ENTERED from NOT_BOOKED → BOOKED (pasted id without click)", () => {
    assert.equal(applyPorterBookingEvent("NOT_BOOKED", "TRACKING_ENTERED"), "BOOKED");
  });

  it("CANCELLED only from pending or booked", () => {
    assert.equal(applyPorterBookingEvent("BOOKING_PENDING", "CANCELLED"), "CANCELLED");
    assert.equal(applyPorterBookingEvent("BOOKED", "CANCELLED"), "CANCELLED");
    assert.equal(applyPorterBookingEvent("NOT_BOOKED", "CANCELLED"), "NOT_BOOKED");
  });
});

describe("canCompleteDispatch (single gate)", () => {
  it("own_fleet requires vehicle + driver", () => {
    assert.equal(canCompleteDispatch({ fulfillmentMode: "own_fleet" }).ok, false);
    assert.equal(
      canCompleteDispatch({
        fulfillmentMode: "own_fleet",
        vehicleInfo: "TN-01",
        assignedDriverId: "d1",
      }).ok,
      true
    );
  });

  it("defaults missing mode to own_fleet (e2e / legacy payloads)", () => {
    const r = canCompleteDispatch({ vehicleInfo: "TN-01", assignedDriverId: "d1" });
    assert.equal(r.ok, true);
    assert.equal(parseFulfillmentMode(undefined), "own_fleet");
  });

  it("porter NOT_BOOKED cannot complete", () => {
    const r = canCompleteDispatch({
      fulfillmentMode: "porter",
      porterBookingStatus: "NOT_BOOKED",
    });
    assert.equal(r.ok, false);
  });

  it("porter BOOKING_PENDING can complete without tracking", () => {
    const r = canCompleteDispatch({
      fulfillmentMode: "porter",
      porterBookingStatus: "BOOKING_PENDING",
    });
    assert.equal(r.ok, true);
  });

  it("porter BOOKED can complete", () => {
    const r = canCompleteDispatch({
      fulfillmentMode: "porter",
      porterBookingStatus: "BOOKED",
      trackingNumber: "P-1",
    });
    assert.equal(r.ok, true);
  });

  it("porter CANCELLED cannot complete", () => {
    const r = canCompleteDispatch({
      fulfillmentMode: "porter",
      porterBookingStatus: "CANCELLED",
    });
    assert.equal(r.ok, false);
  });
});

describe("normalizeDispatchPayload", () => {
  it("own_fleet clears porter status and carrier", () => {
    const n = normalizeDispatchPayload({
      fulfillmentMode: "own_fleet",
      vehicleInfo: "TN-01",
      assignedDriverId: "d1",
      porterBookingStatus: "BOOKING_PENDING",
    });
    assert.equal(n.fulfillmentMode, "own_fleet");
    assert.equal(n.carrier, null);
    assert.equal(n.porterBookingStatus, null);
  });

  it("porter + tracking promotes via state machine to BOOKED", () => {
    const n = normalizeDispatchPayload({
      fulfillmentMode: "porter",
      porterBookingStatus: "BOOKING_PENDING",
      trackingNumber: "P-99",
      trackingUrl: "https://porter.in/track/P-99",
    });
    assert.equal(n.carrier, "porter");
    assert.equal(n.porterBookingStatus, "BOOKED");
    assert.equal(n.trackingNumber, "P-99");
  });

  it("parsePorterBookingStatus falls back to NOT_BOOKED", () => {
    assert.equal(parsePorterBookingStatus("nope"), "NOT_BOOKED");
    assert.equal(parsePorterBookingStatus(null), "NOT_BOOKED");
  });
});
