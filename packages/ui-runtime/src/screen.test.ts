import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeScreenDefinition } from "./screen";

describe("normalizeScreenDefinition", () => {
  it("keeps explicit layout and themeId", () => {
    const s = normalizeScreenDefinition({
      key: "sales_review_form",
      id: "sales-review",
      themeId: "oms-default",
      layout: [
        { widget: "ProductList", props: { editable: true } },
        { widget: "ActionButtons", props: {} },
      ],
    });
    assert.equal(s.layout?.[0]?.widget, "ProductList");
    assert.equal(s.themeId, "oms-default");
  });

  it("throws when layout is missing", () => {
    assert.throws(() =>
      normalizeScreenDefinition({
        key: "warehouse_form",
        fields: [],
      })
    );
  });
});
