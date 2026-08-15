import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kpisForVariant } from "./ops-kpis";

describe("kpisForVariant admin", () => {
  it("leads with to collect / overdue receivables, not revenue", () => {
    const cards = kpisForVariant("admin", {
      revenue: 9_00_000,
      overdueReceivables: 1_20_000,
      toCollect: 2_50_000,
      salesOrders: 12,
      pendingDispatches: 3,
      openTasks: 5,
    });
    assert.deepEqual(
      cards.map((c) => c.label),
      ["To collect / overdue receivables", "Orders", "To fulfil", "Open tasks"]
    );
    assert.equal(cards[0].span, 6);
    assert.equal(cards[0].href, "/admin/ar");
    assert.match(cards[0].value, /1,20,000|120,000/);
  });

  it("falls back to outstanding when nothing is overdue", () => {
    const cards = kpisForVariant("admin", {
      revenue: 50_000,
      overdueReceivables: 0,
      toCollect: 10_000,
      salesOrders: 0,
      pendingDispatches: 0,
      openTasks: 0,
    });
    assert.match(cards[0].value, /10,000/);
    assert.match(cards[0].subtext ?? "", /Revenue this period/);
  });

  it("leaves sales KPIs equal-width and revenue-first for that role", () => {
    const cards = kpisForVariant("sales", { todaySales: 1, mySreqs: 2, myOrders: 3, myTasks: 4 });
    assert.equal(cards[0].label, "Today's sales");
    assert.equal(cards.every((c) => c.span === undefined), true);
  });
});
