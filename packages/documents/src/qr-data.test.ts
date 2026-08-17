import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveQRData, serializeQRData } from "./qr-data";

test("serialize object keys are sorted recursively — never [object Object]", () => {
  assert.equal(serializeQRData({ customer: "ABC", amount: 12500 }), '{"amount":12500,"customer":"ABC"}');
  assert.equal(serializeQRData({ amount: 12500, customer: "ABC" }), '{"amount":12500,"customer":"ABC"}');
  assert.equal(serializeQRData({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test("serialize nested objects sort keys; arrays keep element order", () => {
  assert.equal(
    serializeQRData({ z: { b: 2, a: 1 }, y: [{ d: 4, c: 3 }, { a: 0 }] }),
    '{"y":[{"c":3,"d":4},{"a":0}],"z":{"a":1,"b":2}}'
  );
});

test("serialize primitives", () => {
  assert.equal(serializeQRData("upi://pay?pa=a@b"), "upi://pay?pa=a@b");
  assert.equal(serializeQRData(12500), "12500");
  assert.equal(serializeQRData(12.5), "12.5");
  assert.equal(serializeQRData(true), "true");
  assert.equal(serializeQRData(false), "false");
  assert.equal(serializeQRData(new Date("2026-01-15T00:00:00.000Z")), "2026-01-15T00:00:00.000Z");
  assert.equal(serializeQRData(null), null);
  assert.equal(serializeQRData(undefined), null);
  assert.equal(serializeQRData(""), "");
});

test("resolve: path object → canonical JSON", () => {
  const data = resolveQRData({ path: "some.payload" }, { some: { payload: { b: 2, a: 1 } } });
  assert.equal(data, '{"a":1,"b":2}');
});

test("resolve: path null → hidden", () => {
  assert.equal(resolveQRData({ path: "some.payload" }, { some: { payload: null } }), null);
});

test("resolve: path set but missing does not fall back to text", () => {
  const data = resolveQRData(
    { path: "missing.path", text: "fallback" },
    { other: "x" }
  );
  assert.equal(data, null);
});

test("resolve: empty path uses text; unset source is hidden", () => {
  assert.equal(resolveQRData({ text: "hello" }, {}), "hello");
  assert.equal(resolveQRData({ path: "  ", text: "hello" }, {}), "hello");
  assert.equal(resolveQRData({}, {}), null);
  assert.equal(resolveQRData({ path: "x", text: "hello" }, { x: "" }), null);
});
