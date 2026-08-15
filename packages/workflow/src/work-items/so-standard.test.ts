import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateWorkItems,
  deriveWorkItemStatus,
  primaryActivity,
  SO_STANDARD_WORK_ITEMS,
  workItemDef,
  workItemKeyForActivity,
} from "./so-standard";

describe("SO work items catalog", () => {
  it("maps activities to locked work items", () => {
    assert.equal(workItemKeyForActivity("sales_review"), "confirm_order");
    assert.equal(workItemKeyForActivity("warehouse"), "dispatch_order");
    assert.equal(workItemKeyForActivity("dispatch"), "dispatch_order");
    assert.equal(workItemKeyForActivity("invoice"), "bill_and_collect");
    assert.equal(workItemKeyForActivity("payment"), "bill_and_collect");
    assert.equal(workItemKeyForActivity("close"), null);
  });

  it("hides skipped procurement exception", () => {
    const status = deriveWorkItemStatus(workItemDef("procurement_exception")!, [
      { stepKey: "procurement", status: "SKIPPED" },
    ]);
    assert.equal(status, "HIDDEN");
  });

  it("hides waiting procurement until READY", () => {
    const status = deriveWorkItemStatus(workItemDef("procurement_exception")!, [
      { stepKey: "procurement", status: "WAITING" },
    ]);
    assert.equal(status, "HIDDEN");
  });

  it("shows procurement when READY", () => {
    const status = deriveWorkItemStatus(workItemDef("procurement_exception")!, [
      { stepKey: "procurement", status: "READY", action: "request-vendors", id: "t1" },
    ]);
    assert.equal(status, "READY");
  });

  it("dispatch order ready when warehouse ready", () => {
    const status = deriveWorkItemStatus(workItemDef("dispatch_order")!, [
      { stepKey: "warehouse", status: "READY", action: "warehouse-ready", id: "w" },
      { stepKey: "dispatch", status: "WAITING", action: "dispatch", id: "d" },
    ]);
    assert.equal(status, "READY");
    const primary = primaryActivity(workItemDef("dispatch_order")!, [
      { stepKey: "warehouse", status: "READY", action: "warehouse-ready", id: "w" },
      { stepKey: "dispatch", status: "WAITING", action: "dispatch", id: "d" },
    ]);
    assert.equal(primary?.stepKey, "warehouse");
  });

  it("bill and collect stays open after invoice until payment done", () => {
    const status = deriveWorkItemStatus(workItemDef("bill_and_collect")!, [
      { stepKey: "invoice", status: "COMPLETED", action: "invoice", id: "i" },
      { stepKey: "payment", status: "READY", action: "collect-payment", id: "p" },
    ]);
    assert.equal(status, "READY");
  });

  it("exposes locked operator Work Item labels", () => {
    const labels = SO_STANDARD_WORK_ITEMS.map((w) => w.label);
    assert.deepEqual(labels, [
      "Confirm Order",
      "Check Stock",
      "Procurement Exception",
      "Pricing Review",
      "Dispatch Order",
      "Confirm Delivery",
      "Bill & Collect",
    ]);
  });

  it("aggregates fresh SO to confirm_order READY only actionable", () => {
    const items = aggregateWorkItems([
      { stepKey: "sales_review", status: "READY", action: "review", id: "1", kind: "HUMAN" },
      { stepKey: "inventory", status: "WAITING", action: "verify-stock", id: "2", kind: "HUMAN" },
      { stepKey: "procurement", status: "WAITING", action: "request-vendors", id: "3", kind: "HUMAN" },
      { stepKey: "pricing", status: "WAITING", action: "complete-pricing", id: "4", kind: "HUMAN" },
      { stepKey: "warehouse", status: "WAITING", action: "warehouse-ready", id: "5", kind: "HUMAN" },
      { stepKey: "dispatch", status: "WAITING", action: "dispatch", id: "6", kind: "HUMAN" },
      { stepKey: "deliver", status: "WAITING", action: "deliver-oms", id: "7", kind: "HUMAN" },
      { stepKey: "invoice", status: "WAITING", action: "invoice", id: "8", kind: "HUMAN" },
      { stepKey: "payment", status: "WAITING", action: "collect-payment", id: "9", kind: "HUMAN" },
      { stepKey: "close", status: "WAITING", action: "close", id: "10", kind: "SYSTEM" },
    ]);
    assert.ok(!items.some((i) => i.key === "procurement_exception"));
    const confirm = items.find((i) => i.key === "confirm_order");
    assert.equal(confirm?.status, "READY");
    assert.equal(confirm?.actionable, true);
    const stock = items.find((i) => i.key === "check_stock");
    assert.equal(stock?.status, "WAITING");
    assert.equal(stock?.actionable, false);
  });
});
