import assert from "node:assert/strict";
import { test } from "node:test";
import { tenantCan, tenantPermissions } from "./index";

test("tenant permission matrix grants finance only to finance-capable roles", () => {
  assert.equal(tenantCan("ACCOUNTANT", "finance.write"), true);
  assert.equal(tenantCan("ACCOUNTANT", "inventory.write"), false);
  assert.equal(tenantCan("VIEWER", "reports.read"), true);
  assert.equal(tenantCan("VIEWER", "orders.write"), false);
});

test("unknown roles receive no permissions", () => {
  assert.deepEqual(tenantPermissions("UNKNOWN"), new Set());
});
