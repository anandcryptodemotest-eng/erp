import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOpsAttention, formatAttentionLine } from "./ops-attention";

describe("buildOpsAttention", () => {
  it("hides zero-count rows", () => {
    const items = buildOpsAttention({
      sreqsOpen: 4,
      pendingFulfilment: 0,
      deliveriesPending: 2,
      overdueReceivables: 0,
      openTasks: 5,
    });
    assert.deepEqual(
      items.map((i) => i.id),
      ["sreqs", "deliveries", "tasks"]
    );
  });

  it("returns empty when the desk is clear", () => {
    const items = buildOpsAttention({
      sreqsOpen: 0,
      pendingFulfilment: 0,
      deliveriesPending: 0,
      overdueReceivables: 0,
      openTasks: 0,
    });
    assert.equal(items.length, 0);
  });

  it("keeps overdue receivables as a money row", () => {
    const items = buildOpsAttention({
      sreqsOpen: 0,
      pendingFulfilment: 0,
      deliveriesPending: 0,
      overdueReceivables: 120000,
      openTasks: 0,
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "overdue");
    assert.equal(items[0].kind, "money");
    assert.match(formatAttentionLine(items[0]), /overdue receivables/);
  });
});
