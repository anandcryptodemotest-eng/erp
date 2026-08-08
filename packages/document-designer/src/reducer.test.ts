import { test } from "node:test";
import assert from "node:assert/strict";
import { TAX_INVOICE_SEED } from "@erp/documents";
import { canvasReducer, createInitialState } from "./reducer";
import { snap } from "./snap";

test("snap grid", () => {
  assert.equal(snap(7, 4), 8);
  assert.equal(snap(7, 0), 7);
  assert.equal(snap(5, 8), 8);
});

test("MoveItems updates definition immutably", () => {
  const state = createInitialState(TAX_INVOICE_SEED);
  const next = canvasReducer(state, {
    type: "MoveItems",
    ids: ["seller"],
    dx: 10,
    dy: 0,
  });
  assert.notEqual(next.definition, state.definition);
  const seller = next.definition.items.find((i) => i.id === "seller");
  const orig = state.definition.items.find((i) => i.id === "seller");
  assert.ok(seller && orig);
  assert.equal(seller.placement.x, orig.placement.x + 10);
  // Child local coords unchanged (Figma frame)
  const label = seller.children?.find((c) => c.id === "sellerLabel");
  const origLabel = orig.children?.find((c) => c.id === "sellerLabel");
  assert.equal(label?.placement.x, origLabel?.placement.x);
  assert.equal(label?.placement.y, origLabel?.placement.y);
});

test("SetSelection uses Set", () => {
  const state = createInitialState(TAX_INVOICE_SEED);
  const next = canvasReducer(state, {
    type: "SetSelection",
    ids: ["seller", "buyer"],
  });
  assert.equal(next.selectedIds.size, 2);
  assert.ok(next.selectedIds.has("seller"));
});

test("ResizeItems se handle", () => {
  const state = createInitialState(TAX_INVOICE_SEED);
  const before = state.definition.items.find((i) => i.id === "lines")!;
  const next = canvasReducer(state, {
    type: "ResizeItems",
    id: "lines",
    handle: "se",
    dx: 20,
    dy: 20,
  });
  const after = next.definition.items.find((i) => i.id === "lines")!;
  assert.equal(after.placement.width, before.placement.width + 20);
  assert.equal((after.placement.height ?? 0), (before.placement.height ?? 0) + 20);
});
