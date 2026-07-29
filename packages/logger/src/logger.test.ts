import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createLogger,
  resolveRequestIds,
  runWithRequestContext,
  getRequestContext,
  requestIdHeaders,
} from "./index";

describe("@erp/logger", () => {
  it("mints request id when missing", () => {
    const h = new Headers();
    const ids = resolveRequestIds(h);
    assert.ok(ids.requestId.length > 10);
    assert.equal(ids.correlationId, ids.requestId);
  });

  it("propagates inbound x-request-id", () => {
    const h = new Headers({ "x-request-id": "abc-123" });
    const ids = resolveRequestIds(h);
    assert.equal(ids.requestId, "abc-123");
  });

  it("binds ALS context", () => {
    runWithRequestContext({ requestId: "r1", tenantId: "t1" }, () => {
      assert.equal(getRequestContext()?.requestId, "r1");
      assert.equal(requestIdHeaders()["x-request-id"], "r1");
    });
  });

  it("createLogger does not throw", () => {
    const log = createLogger({ service: "test" });
    log.info("hello", { n: 1 });
    log.error("boom", { err: new Error("x") });
  });
});
