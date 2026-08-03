import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { moveItem } from "./reorder";

describe("moveItem", () => {
  it("moves up and down", () => {
    assert.deepEqual(moveItem(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
    assert.deepEqual(moveItem(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
  });

  it("no-ops at edges", () => {
    assert.deepEqual(moveItem(["a", "b"], 0, -1), ["a", "b"]);
    assert.deepEqual(moveItem(["a", "b"], 1, 1), ["a", "b"]);
  });
});
