import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateWorkflowDefinition } from "../validator";
import { hasCycle, startNodes } from "../graph";
import { ConditionRegistry } from "../conditions";
import { evaluateReadiness } from "../engine/evaluate";
import { SO_STANDARD_V5, SO_TASK_TYPES } from "../templates/so-standard-v5";
import { simulateWorkflow } from "../simulation";
import type { WorkflowDefinition } from "../types/definition";

const taskTypes = SO_TASK_TYPES.map((t) => t.type);
const conditions = ["always", "never", "shortage"];

describe("SO_STANDARD_V5 definition", () => {
  it("passes publish validation", () => {
    const result = validateWorkflowDefinition(SO_STANDARD_V5, {
      registeredTaskTypes: taskTypes,
      registeredConditions: conditions,
      previousVersion: 4,
    });
    assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
    assert.equal(startNodes(SO_STANDARD_V5).length, 1);
    assert.equal(hasCycle(SO_STANDARD_V5), false);
  });

  it("rejects cycles", () => {
    const cyclic: WorkflowDefinition = {
      ...SO_STANDARD_V5,
      version: 6,
      edges: [...SO_STANDARD_V5.edges, { from: "close", to: "sales_review" }],
    };
    const result = validateWorkflowDefinition(cyclic, {
      registeredTaskTypes: taskTypes,
      registeredConditions: conditions,
      previousVersion: 5,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "CYCLE"));
  });

  it("rejects unregistered task type", () => {
    const bad: WorkflowDefinition = {
      ...SO_STANDARD_V5,
      version: 6,
      activities: SO_STANDARD_V5.activities.map((a) =>
        a.key === "pricing" ? { ...a, type: "NOT_A_TYPE" } : a
      ),
    };
    const result = validateWorkflowDefinition(bad, {
      registeredTaskTypes: taskTypes,
      registeredConditions: conditions,
      previousVersion: 5,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "TASK_TYPE_UNREGISTERED"));
  });
});

describe("evaluateReadiness sequential + optional procurement", () => {
  const registry = new ConditionRegistry();

  it("only sales_review is ready at start", () => {
    const r = evaluateReadiness(SO_STANDARD_V5, {}, {}, registry);
    assert.deepEqual(r.readyKeys, ["sales_review"]);
  });

  it("after sales_review, inventory is ready — not pricing", () => {
    const r = evaluateReadiness(SO_STANDARD_V5, { sales_review: "COMPLETED" }, {}, registry);
    assert.deepEqual(r.readyKeys, ["inventory"]);
    assert.ok(!r.readyKeys.includes("pricing"));
  });

  it("without shortage, skips procurement and unlocks pricing after inventory", () => {
    const r = evaluateReadiness(
      SO_STANDARD_V5,
      { sales_review: "COMPLETED", inventory: "COMPLETED" },
      { shortage: false },
      registry
    );
    assert.ok(r.skippedKeys.includes("procurement"));
    // pricing still waits on procurement terminal — skip then re-eval
    const r2 = evaluateReadiness(
      SO_STANDARD_V5,
      { sales_review: "COMPLETED", inventory: "COMPLETED", procurement: "SKIPPED" },
      { shortage: false },
      registry
    );
    assert.ok(r2.readyKeys.includes("pricing"));
    assert.ok(!r2.readyKeys.includes("warehouse"));
  });

  it("with shortage, pricing waits until procurement completed", () => {
    const r = evaluateReadiness(
      SO_STANDARD_V5,
      { sales_review: "COMPLETED", inventory: "COMPLETED" },
      { shortage: true },
      registry
    );
    assert.ok(r.readyKeys.includes("procurement"));
    assert.ok(!r.readyKeys.includes("pricing"));

    const r2 = evaluateReadiness(
      SO_STANDARD_V5,
      { sales_review: "COMPLETED", inventory: "COMPLETED", procurement: "COMPLETED" },
      { shortage: true },
      registry
    );
    assert.ok(r2.readyKeys.includes("pricing"));
  });
});

describe("simulateWorkflow", () => {
  it("walks sequential path without shortage", () => {
    const registry = new ConditionRegistry();
    const gen = simulateWorkflow(SO_STANDARD_V5, registry, { shortage: false });
    let step = gen.next();
    assert.ok(step.value.readyKeys.includes("sales_review"));

    const order = [
      "sales_review",
      "inventory",
      "pricing",
      "warehouse",
      "dispatch",
      "deliver",
      "invoice",
      "payment",
      "close",
    ];
    for (const key of order) {
      while (!step.done && !step.value.readyKeys.includes(key) && step.value.skippedKeys.length) {
        // advance after skips
        step = gen.next({ completeKey: step.value.readyKeys[0]! });
      }
      assert.ok(step.value.readyKeys.includes(key), `expected ${key} ready, got ${JSON.stringify(step.value)}`);
      step = gen.next({ completeKey: key });
    }
  });
});
