import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateForm, validatePublish } from "./form";
import type { FormDefinition } from "../types/definition";

const base: FormDefinition = {
  key: "demo_form",
  id: "demo",
  title: "Demo",
  fields: [{ key: "name", label: "Name", type: "text" }],
  layout: [
    { widget: "FormFields", props: {} },
    { widget: "ActionButtons", props: {} },
  ],
};

describe("validateForm", () => {
  it("allows a well-formed draft", () => {
    const r = validateForm(base);
    assert.equal(r.canSave, true);
    assert.equal(r.errors.length, 0);
  });

  it("rejects missing field labels", () => {
    const r = validateForm({
      ...base,
      fields: [{ key: "x", label: "", type: "text" }],
    });
    assert.equal(r.canSave, false);
    assert.ok(r.errors.some((e) => e.code === "FIELD_LABEL_REQUIRED"));
  });

  it("detects duplicate keys", () => {
    const r = validateForm({
      ...base,
      fields: [
        { key: "a", label: "A", type: "text" },
        { key: "a", label: "B", type: "text" },
      ],
    });
    assert.ok(r.errors.some((e) => e.code === "FIELD_KEY_DUPLICATE"));
  });
});

describe("validatePublish", () => {
  it("blocks publish without layout", () => {
    const r = validatePublish({ ...base, layout: [] });
    assert.equal(r.canPublish, false);
    assert.ok(r.errors.some((e) => e.code === "PUBLISH_LAYOUT_REQUIRED"));
  });

  it("allows publish with layout", () => {
    const r = validatePublish(base);
    assert.equal(r.canPublish, true);
  });
});
