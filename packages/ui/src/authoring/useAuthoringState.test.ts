import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deepEqual } from "./useAuthoringState";

describe("deepEqual", () => {
  it("treats key order as irrelevant", () => {
    assert.equal(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
  });

  it("detects nested changes", () => {
    assert.equal(deepEqual({ fields: [{ key: "a" }] }, { fields: [{ key: "b" }] }), false);
  });

  it("handles arrays", () => {
    assert.equal(deepEqual([1, 2], [1, 2]), true);
    assert.equal(deepEqual([1, 2], [2, 1]), false);
  });
});
