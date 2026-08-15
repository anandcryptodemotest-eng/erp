import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInvoicesOutstandingHref,
  buildMyTasksStatusHref,
  buildOrderStatusHref,
  buildOutstandingInvoiceHref,
  buildRevenueTrendHref,
  buildSreqStatusHref,
  buildTopProductsHref,
  countByStatus,
  formatStatusLabel,
  positiveStatusCounts,
  revenueTrendRangeBounds,
  taskVizMode,
  toDayParam,
} from "./hrefs";

describe("chart href builders", () => {
  it("buildRevenueTrendHref uses Desk from/to day params", () => {
    assert.equal(
      buildRevenueTrendHref({ from: "2026-08-14", to: "2026-08-14" }),
      "/admin/sales-desk?from=2026-08-14&to=2026-08-14&tab=inflight"
    );
  });

  it("buildOrderStatusHref maps inflight aliases and raw statuses", () => {
    assert.equal(buildOrderStatusHref("inflight"), "/admin/sales-desk?tab=inflight&status=inflight");
    assert.equal(buildOrderStatusHref("In Flight"), "/admin/sales-desk?tab=inflight&status=inflight");
    assert.equal(buildOrderStatusHref("DISPATCHED"), "/admin/sales-desk?tab=inflight&status=DISPATCHED");
  });

  it("buildMyTasksStatusHref and buildSreqStatusHref", () => {
    assert.equal(buildMyTasksStatusHref(), "/admin/sales-desk?tab=tasks");
    assert.equal(buildMyTasksStatusHref("PENDING"), "/admin/sales-desk?tab=tasks&taskStatus=PENDING");
    assert.equal(buildSreqStatusHref("OPEN"), "/admin/sales-desk?tab=sreq&sreqStatus=OPEN");
  });

  it("buildOutstandingInvoiceHref targets AR buckets", () => {
    assert.equal(buildOutstandingInvoiceHref("all"), "/admin/ar");
    assert.equal(buildOutstandingInvoiceHref("90+"), "/admin/ar?bucket=d90_plus");
  });

  it("buildTopProductsHref and invoices helper", () => {
    assert.equal(buildTopProductsHref(), "/admin/products");
    assert.equal(buildTopProductsHref("prod_1"), "/admin/products?id=prod_1");
    assert.equal(buildInvoicesOutstandingHref(), "/admin/invoices?status=outstanding");
  });

  it("toDayParam normalizes ISO dates", () => {
    assert.equal(toDayParam("2026-08-14"), "2026-08-14");
  });
});

describe("countByStatus", () => {
  it("aggregates and excludes completed", () => {
    const counts = countByStatus(
      [
        { status: "PENDING" },
        { status: "PENDING" },
        { status: "IN_PROGRESS" },
        { status: "COMPLETED" },
      ],
      { exclude: ["COMPLETED", "CANCELLED"] }
    );
    assert.deepEqual(counts, [
      { status: "PENDING", count: 2 },
      { status: "IN_PROGRESS", count: 1 },
    ]);
  });

  it("formatStatusLabel", () => {
    assert.equal(formatStatusLabel("IN_PROGRESS"), "In Progress");
  });
});

describe("taskVizMode (BL-044)", () => {
  it("empty / single / multi from positive counts", () => {
    assert.equal(taskVizMode([]), "empty");
    assert.equal(taskVizMode([{ status: "READY", count: 0 }]), "empty");
    assert.equal(taskVizMode([{ status: "READY", count: 6 }]), "single");
    assert.equal(
      taskVizMode([
        { status: "READY", count: 4 },
        { status: "BLOCKED", count: 1 },
      ]),
      "multi"
    );
  });

  it("positiveStatusCounts drops zeros", () => {
    assert.deepEqual(
      positiveStatusCounts([
        { status: "READY", count: 2 },
        { status: "BLOCKED", count: 0 },
      ]),
      [{ status: "READY", count: 2 }]
    );
  });
});

describe("revenueTrendRangeBounds (BL-042/044)", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");

  it("7D and 30D use UTC day windows ending today", () => {
    assert.deepEqual(revenueTrendRangeBounds("7D", now), {
      from: "2026-08-09T00:00:00.000Z",
      to: "2026-08-15T23:59:59.999Z",
    });
    assert.deepEqual(revenueTrendRangeBounds("30D", now), {
      from: "2026-07-17T00:00:00.000Z",
      to: "2026-08-15T23:59:59.999Z",
    });
  });

  it("MTD and QTD start at month / quarter", () => {
    assert.deepEqual(revenueTrendRangeBounds("MTD", now), {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-15T23:59:59.999Z",
    });
    assert.deepEqual(revenueTrendRangeBounds("QTD", now), {
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-08-15T23:59:59.999Z",
    });
  });
});
