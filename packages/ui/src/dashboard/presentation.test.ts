import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPresentationWidgets, viewportFromWidth } from "./presentation";

describe("getPresentationWidgets", () => {
  const input = [
    { type: "ops-kpi-row", id: "a" },
    { type: "sreq-order-table", id: "b" },
    { type: "my-tasks-list", id: "c" },
    { type: "recent-customers", id: "d" },
  ];

  it("returns shallow copy without reordering on desktop", () => {
    const out = getPresentationWidgets(input, { adminMode: "operational", viewport: "desktop" });
    assert.deepEqual(
      out.map((w) => w.type),
      input.map((w) => w.type)
    );
    assert.notEqual(out, input);
  });

  it("returns shallow copy without phone policy when dense", () => {
    const out = getPresentationWidgets(input, { adminMode: "dense", viewport: "phone" });
    assert.deepEqual(
      out.map((w) => w.type),
      input.map((w) => w.type)
    );
  });

  it("orders my-tasks then ops-kpi then secondary on operational phone", () => {
    const out = getPresentationWidgets(input, { adminMode: "operational", viewport: "phone" });
    assert.deepEqual(
      out.map((w) => w.type),
      ["my-tasks-list", "ops-kpi-row", "sreq-order-table", "recent-customers"]
    );
  });

  it("does not mutate the input array or element order", () => {
    const snapshot = input.map((w) => w.type);
    const refs = [...input];
    getPresentationWidgets(input, { adminMode: "operational", viewport: "phone" });
    assert.deepEqual(
      input.map((w) => w.type),
      snapshot
    );
    assert.equal(input[0], refs[0]);
    assert.equal(input[1], refs[1]);
    assert.equal(input[2], refs[2]);
    assert.equal(input[3], refs[3]);
  });
});

describe("viewportFromWidth", () => {
  it("buckets phone tablet desktop", () => {
    assert.equal(viewportFromWidth(375), "phone");
    assert.equal(viewportFromWidth(767), "phone");
    assert.equal(viewportFromWidth(768), "tablet");
    assert.equal(viewportFromWidth(1023), "tablet");
    assert.equal(viewportFromWidth(1024), "desktop");
  });
});
