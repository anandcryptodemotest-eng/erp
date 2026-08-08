import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRICE_LIST_READ_ROLES,
  PRICE_LIST_WRITE_ROLES,
  PRODUCT_READ_ROLES,
  roleAllowed,
  requirePriceListRead,
  requirePriceListWrite,
  requireProductRead,
} from "./role-gates";

function req(role?: string, serviceKey?: string) {
  const headers = new Headers();
  if (role) headers.set("x-user-role", role);
  if (serviceKey) headers.set("x-service-key", serviceKey);
  return new Request("http://localhost/api/test", { headers });
}

test("sales can read products, not price lists", () => {
  assert.equal(roleAllowed("SALES_EXECUTIVE", PRODUCT_READ_ROLES), true);
  assert.equal(roleAllowed("SALES_EXECUTIVE", PRICE_LIST_READ_ROLES), false);
  assert.equal(requireProductRead(req("SALES_EXECUTIVE")), null);
  assert.equal(requirePriceListRead(req("SALES_EXECUTIVE"))?.status, 403);
});

test("pricing can read/write price lists and read products", () => {
  assert.equal(roleAllowed("PRICING_EXECUTIVE", PRODUCT_READ_ROLES), true);
  assert.equal(roleAllowed("PRICING_EXECUTIVE", PRICE_LIST_READ_ROLES), true);
  assert.equal(roleAllowed("PRICING_EXECUTIVE", PRICE_LIST_WRITE_ROLES), true);
  assert.equal(requirePriceListWrite(req("PRICING_EXECUTIVE")), null);
});

test("dispatch cannot read products or price lists", () => {
  assert.equal(requireProductRead(req("DISPATCH_EXECUTIVE"))?.status, 403);
  assert.equal(requirePriceListRead(req("DISPATCH_EXECUTIVE"))?.status, 403);
});

test("accountant cannot read product list", () => {
  assert.equal(requireProductRead(req("ACCOUNTANT"))?.status, 403);
});

test("trusted service bypasses role gates", () => {
  const prev = process.env.SERVICE_SECRET;
  process.env.SERVICE_SECRET = "test-secret";
  try {
    assert.equal(requireProductRead(req(undefined, "test-secret")), null);
    assert.equal(requirePriceListRead(req(undefined, "test-secret")), null);
    assert.equal(requireProductRead(req("CUSTOMER", "test-secret")), null);
  } finally {
    if (prev === undefined) delete process.env.SERVICE_SECRET;
    else process.env.SERVICE_SECRET = prev;
  }
});

test("trusted service does not bypass staff role gates", () => {
  const prev = process.env.SERVICE_SECRET;
  process.env.SERVICE_SECRET = "test-secret";
  try {
    assert.equal(requireProductRead(req("DISPATCH_EXECUTIVE", "test-secret"))?.status, 403);
    assert.equal(requirePriceListRead(req("SALES_EXECUTIVE", "test-secret"))?.status, 403);
    assert.equal(requirePriceListWrite(req("PRICING_EXECUTIVE", "test-secret")), null);
  } finally {
    if (prev === undefined) delete process.env.SERVICE_SECRET;
    else process.env.SERVICE_SECRET = prev;
  }
});
