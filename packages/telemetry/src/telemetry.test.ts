import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { livePayload, readyPayload } from "./health";
import { withSpan, recordEvent, addSpanAttributes, activeTraceIds } from "./helpers";

describe("@erp/telemetry", () => {
  it("livePayload schema", () => {
    const p = livePayload("sales");
    assert.equal(p.status, "UP");
    assert.equal(p.service, "sales");
    assert.ok(typeof p.uptimeSeconds === "number");
    assert.equal(p.checks.process, "UP");
  });

  it("readyPayload aggregates DOWN", () => {
    const p = readyPayload("sales", { database: "DOWN", telemetry: "UP" });
    assert.equal(p.status, "DOWN");
  });

  it("withSpan runs without SDK", async () => {
    const v = await withSpan("Test.Span", async () => 42, { a: 1 });
    assert.equal(v, 42);
    recordEvent("TestEvent", { x: true });
    addSpanAttributes({ y: 2 });
    activeTraceIds();
  });
});
