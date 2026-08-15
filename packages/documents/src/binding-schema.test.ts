import { test } from "node:test";
import assert from "node:assert/strict";
import { INVOICE_BINDING_SCHEMA, listCollectionLeaves, listBindingLeaves } from "./binding-schema";

test("invoice lines path is a collection leaf", () => {
  const cols = listCollectionLeaves(INVOICE_BINDING_SCHEMA);
  assert.equal(cols.length, 1);
  assert.equal(cols[0].path, "lines");
  assert.equal(cols[0].collection, true);
});

test("listBindingLeaves includes collection and scalar paths", () => {
  const paths = listBindingLeaves(INVOICE_BINDING_SCHEMA).map((f) => f.path);
  assert.ok(paths.includes("lines"));
  assert.ok(paths.includes("seller.name"));
});
