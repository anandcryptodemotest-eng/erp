import assert from "node:assert/strict";
import { test } from "node:test";
import { isSharedIpHostname, tenantSlugFromSearch } from "./tenant";

test("tenantSlugFromSearch reads tenant=", () => {
  assert.equal(tenantSlugFromSearch("?tenant=gf-mskn4dia"), "gf-mskn4dia");
  assert.equal(tenantSlugFromSearch("tenant=gf-mskn4dia&returnTo=/shop"), "gf-mskn4dia");
});

test("tenantSlugFromSearch reads t= alias and lowercases", () => {
  assert.equal(tenantSlugFromSearch("?t=GF-MSKN4DIA"), "gf-mskn4dia");
});

test("tenantSlugFromSearch ignores empty", () => {
  assert.equal(tenantSlugFromSearch(""), null);
  assert.equal(tenantSlugFromSearch("?returnTo=/shop"), null);
});

test("isSharedIpHostname detects VPS IP", () => {
  assert.equal(isSharedIpHostname("150.242.201.102"), true);
  assert.equal(isSharedIpHostname("shop.example.com"), false);
});
