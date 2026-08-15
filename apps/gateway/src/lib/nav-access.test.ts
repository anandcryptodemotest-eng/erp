import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canAccessModule,
  defaultHomePath,
  normalizeNavKey,
  pathToModuleKey,
  resolveNavModules,
} from "./nav-access";

test("oms is a legacy alias of order_desk, not an independent key", () => {
  assert.equal(normalizeNavKey("oms"), "order_desk");
  assert.equal(normalizeNavKey("order_desk"), "order_desk");
  assert.equal(pathToModuleKey("/sales-desk"), "order_desk");
  assert.equal(pathToModuleKey("/oms"), "order_desk");
  assert.equal(pathToModuleKey("/admin/sales-desk"), "order_desk");
});

test("catalog screens are split nav keys", () => {
  assert.equal(pathToModuleKey("/products"), "products");
  assert.equal(pathToModuleKey("/categories"), "categories");
  assert.equal(pathToModuleKey("/brands"), "brands");
  assert.equal(pathToModuleKey("/attributes"), "attributes");
  assert.equal(pathToModuleKey("/price-lists"), "price_lists");
});

test("sales nav has products + customers + order desk, not catalog admin screens", () => {
  const allowed = resolveNavModules("SALES_EXECUTIVE");
  assert.equal(canAccessModule(allowed, "dashboard"), true);
  assert.equal(canAccessModule(allowed, "products"), true);
  assert.equal(canAccessModule(allowed, "customers"), true);
  assert.equal(canAccessModule(allowed, "order_desk"), true);
  assert.equal(canAccessModule(allowed, "oms"), true);
  assert.equal(canAccessModule(allowed, "price_lists"), false);
  assert.equal(canAccessModule(allowed, "categories"), false);
  assert.equal(canAccessModule(allowed, "administration"), false);
});

test("pricing nav has price lists + order desk, not customers", () => {
  const allowed = resolveNavModules("PRICING_EXECUTIVE");
  assert.equal(canAccessModule(allowed, "products"), true);
  assert.equal(canAccessModule(allowed, "price_lists"), true);
  assert.equal(canAccessModule(allowed, "order_desk"), true);
  assert.equal(canAccessModule(allowed, "customers"), false);
});

test("catalog manager has catalog screens and no order desk", () => {
  const allowed = resolveNavModules("CATALOG_MANAGER");
  assert.equal(canAccessModule(allowed, "products"), true);
  assert.equal(canAccessModule(allowed, "categories"), true);
  assert.equal(canAccessModule(allowed, "brands"), true);
  assert.equal(canAccessModule(allowed, "attributes"), true);
  assert.equal(canAccessModule(allowed, "price_lists"), true);
  assert.equal(canAccessModule(allowed, "order_desk"), false);
  assert.equal(canAccessModule(allowed, "customers"), false);
});

test("legacy oms override maps onto order_desk", () => {
  const allowed = resolveNavModules("USER", ["dashboard", "oms"]);
  assert.equal(canAccessModule(allowed, "order_desk"), true);
  assert.equal(canAccessModule(allowed, "oms"), true);
});

test("home path is dashboard-first", () => {
  assert.equal(defaultHomePath(resolveNavModules("SALES_EXECUTIVE")), "/dashboard");
  assert.equal(defaultHomePath(resolveNavModules("PRICING_EXECUTIVE")), "/dashboard");
  assert.equal(defaultHomePath(resolveNavModules("DISPATCH_EXECUTIVE")), "/dashboard");
  assert.equal(defaultHomePath(resolveNavModules("CATALOG_MANAGER")), "/dashboard");
  assert.equal(defaultHomePath(resolveNavModules("ACCOUNTANT")), "/dashboard");
  assert.equal(defaultHomePath(resolveNavModules("DELIVERY_EXECUTIVE")), "/dashboard");
});

test("Free plan features hide Order Desk from ADMIN", () => {
  const allowed = resolveNavModules("ADMIN", null, null, ["dashboard", "organization", "users"]);
  assert.equal(canAccessModule(allowed, "dashboard"), true);
  assert.equal(canAccessModule(allowed, "administration"), true);
  assert.equal(canAccessModule(allowed, "users"), true);
  assert.equal(canAccessModule(allowed, "order_desk"), false);
  assert.equal(canAccessModule(allowed, "products"), false);
});

test("Messages (communication) survives plan feature intersection", () => {
  const free = resolveNavModules("ADMIN", null, null, ["dashboard", "organization", "users"]);
  assert.equal(canAccessModule(free, "communication"), true);
  const oms = resolveNavModules("SALES_EXECUTIVE", null, null, ["dashboard", "oms"]);
  assert.equal(canAccessModule(oms, "communication"), true);
  assert.equal(canAccessModule(oms, "order_desk"), true);
});
