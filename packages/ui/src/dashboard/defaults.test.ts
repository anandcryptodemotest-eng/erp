import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roleDefaultConfig, shouldReplaceStaleRoleLayout } from "./defaults";

describe("roleDefaultConfig curated samples (BL-041)", () => {
  it("admin: attention → KPIs → tasks → pipeline → revenue trend", () => {
    const widgets = roleDefaultConfig("ADMIN", "ADMIN").widgets;
    assert.deepEqual(
      widgets.map((w) => w.type),
      [
        "today-attention",
        "ops-kpi-row",
        "my-tasks-list",
        "recent-activity",
        "sreq-order-table",
        "order-status",
        "revenue-trend",
      ]
    );
    assert.equal(widgets[1].config?.variant, "admin");
    assert.equal(widgets.some((w) => /order.?desk|sales-desk/i.test(w.type)), false);
  });

  it("sales: KPI → tasks|pipeline → trend|customers (BL-044)", () => {
    const widgets = roleDefaultConfig("SALES", "ADMIN").widgets;
    assert.deepEqual(
      widgets.map((w) => w.type),
      ["ops-kpi-row", "my-tasks-list", "sreq-order-table", "revenue-trend", "recent-customers"]
    );
    const trend = widgets.find((w) => w.type === "revenue-trend");
    const customers = widgets.find((w) => w.type === "recent-customers");
    assert.equal(trend?.y, 6);
    assert.equal(trend?.w, 8);
    assert.equal(customers?.y, 6);
    assert.equal(customers?.w, 4);
    assert.equal(widgets.some((w) => w.type === "today-attention"), false);
  });

  it("pricing / dispatch / delivery / accountant include my-tasks", () => {
    for (const role of ["PRICING", "DISPATCH", "DELIVERY", "ACCOUNTANT"] as const) {
      const types = roleDefaultConfig(role, "ADMIN").widgets.map((w) => w.type);
      assert.ok(types.includes("my-tasks-list"), `${role} missing my-tasks-list`);
      assert.ok(types.includes("ops-kpi-row"), `${role} missing ops-kpi-row`);
    }
  });

  it("catalog and procurement include stock attention", () => {
    assert.ok(roleDefaultConfig("CATALOG_MANAGER", "ADMIN").widgets.some((w) => w.type === "low-stock"));
    assert.ok(roleDefaultConfig("PROCUREMENT_OFFICER", "ADMIN").widgets.some((w) => w.type === "top-products"));
  });

  it("viewer is read-oriented with revenue trend", () => {
    const types = roleDefaultConfig("VIEWER", "ADMIN").widgets.map((w) => w.type);
    assert.ok(types.includes("revenue-trend"));
    assert.equal(types.includes("my-tasks-list"), false);
  });
});

describe("shouldReplaceStaleRoleLayout (BL-041 never overwrite Customize)", () => {
  it("never soft-replaces saved layouts", () => {
    assert.equal(shouldReplaceStaleRoleLayout("ADMIN", [{ type: "ops-kpi-row" }]), false);
    assert.equal(
      shouldReplaceStaleRoleLayout("SALES", [{ type: "ops-kpi-row" }, { type: "my-tasks-list" }]),
      false
    );
    assert.equal(shouldReplaceStaleRoleLayout("ADMIN", []), false);
  });
});
