import assert from "node:assert/strict";
import { test } from "node:test";
import { applyHostLayoutChrome } from "./ScreenController";

test("host chrome moves FormFields below ProductList and injects Notes/Attachments", () => {
  const layout = applyHostLayoutChrome(
    { action: "review", label: "Confirm" },
    [
      { widget: "FormFields", props: {} },
      { widget: "ProductList", props: {} },
      { widget: "CatalogSearch", props: {} },
      { widget: "ActionButtons", props: {} },
    ]
  )!;
  const widgets = layout.map((w) => w.widget);
  assert.deepEqual(widgets, [
    "CustomerInfo",
    "ProductList",
    "CatalogSearch",
    "FormFields",
    "Notes",
    "Attachments",
    "ActionButtons",
  ]);
});

test("host chrome does not duplicate Comments/FileUpload", () => {
  const layout = applyHostLayoutChrome(
    { action: "review", label: "Confirm" },
    [
      { widget: "CustomerInfo", props: {} },
      { widget: "ProductList", props: {} },
      { widget: "FormFields", props: {} },
      { widget: "Notes", props: {} },
      { widget: "Attachments", props: {} },
      { widget: "ActionButtons", props: {} },
    ]
  )!;
  assert.equal(layout.filter((w) => w.widget === "Notes" || w.widget === "Comments").length, 1);
  assert.equal(layout.filter((w) => w.widget === "Attachments" || w.widget === "FileUpload").length, 1);
  assert.equal(layout.filter((w) => w.widget === "CustomerInfo").length, 1);
});
