import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FormDefinition } from "../types/definition";
import {
  classifyStarterFormHash,
  hashFormDefinition,
  normalizeFormDefinitionForHash,
} from "./starter-hash";

const sampleA: FormDefinition = {
  id: "sales-review",
  key: "sales_review_form",
  title: "Sales review",
  themeId: "oms-default",
  layout: [
    { widget: "FormFields", props: {} },
    { widget: "ActionButtons", props: {} },
  ],
  fields: [{ key: "remarks", label: "Remarks", type: "text", scope: "order" }],
};

const sampleB: FormDefinition = {
  ...sampleA,
  layout: [
    { widget: "StatusBanner", props: {} },
    { widget: "FormFields", props: {} },
    { widget: "ActionButtons", props: {} },
  ],
};

describe("normalizeFormDefinitionForHash", () => {
  it("ignores key order differences", () => {
    const a = normalizeFormDefinitionForHash(sampleA);
    const b = normalizeFormDefinitionForHash({
      ...sampleA,
      fields: [{ scope: "order", type: "text", label: "Remarks", key: "remarks" }],
    });
    assert.deepEqual(a, b);
  });
});

describe("hashFormDefinition", () => {
  it("differs when layout changes", () => {
    assert.notEqual(hashFormDefinition(sampleA), hashFormDefinition(sampleB));
  });

  it("is stable for identical semantic content", () => {
    assert.equal(hashFormDefinition(sampleA), hashFormDefinition({ ...sampleA }));
  });
});

describe("classifyStarterFormHash", () => {
  const hashes = { 1: "aaa", 2: "bbb" };

  it("marks latest as already-current", () => {
    assert.equal(classifyStarterFormHash("bbb", hashes, 2), "already-current");
  });

  it("marks prior revision as eligible", () => {
    assert.equal(classifyStarterFormHash("aaa", hashes, 2), "eligible");
  });

  it("marks unknown as customized", () => {
    assert.equal(classifyStarterFormHash("zzz", hashes, 2), "customized");
  });

  it("marks null as missing", () => {
    assert.equal(classifyStarterFormHash(null, hashes, 2), "missing");
  });
});
