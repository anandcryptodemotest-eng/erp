import { test } from "node:test";
import assert from "node:assert/strict";
import { TAX_INVOICE_SEED } from "./seed-tax-invoice";
import {
  expandDocumentDefinition,
  expandWidgets,
  PRINT_WIDGET_CATALOG,
  type PrintWidgetId,
} from "./print-widgets";
import type { DocumentDefinition, PlacedItem } from "./types";

function widget(id: string, widgetId: PrintWidgetId, placement: PlacedItem["placement"]): PlacedItem {
  return {
    id,
    name: widgetId,
    type: "Widget",
    widgetId,
    widgetConfig: {},
    placement,
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: 0,
    opacity: 1,
  };
}

test("catalog has the five v1 widgets", () => {
  assert.deepEqual(
    PRINT_WIDGET_CATALOG.map((w) => w.id),
    ["doc.logo", "doc.seller", "doc.buyer", "doc.lineItems", "doc.totals"]
  );
});

test("expand doc.lineItems → Table bound to lines with commercial columns, no HSN", () => {
  const expanded = expandWidgets([
    widget("w_lines", "doc.lineItems", { x: 0, y: 200, width: 515, height: 280 }),
  ]);
  assert.equal(expanded[0].type, "Table");
  assert.equal(expanded[0].binding?.path, "lines");
  const columns = expanded[0].properties?.columns as { key: string }[];
  assert.deepEqual(
    columns.map((c) => c.key),
    ["sku", "description", "qty", "rate", "tax", "amount"]
  );
  assert.ok(!columns.some((c) => c.key === "hsn"));
});

test("expand doc.logo → Logo bound to seller.logoUrl", () => {
  const expanded = expandWidgets([
    widget("w_logo", "doc.logo", { x: 0, y: 0, width: 120, height: 48 }),
  ]);
  assert.equal(expanded[0].type, "Logo");
  assert.equal(expanded[0].binding?.path, "seller.logoUrl");
});

test("expand does not mutate saved Widget refs", () => {
  const original: PlacedItem[] = [
    widget("w_seller", "doc.seller", { x: 0, y: 88, width: 250, height: 90 }),
  ];
  const copy = JSON.parse(JSON.stringify(original)) as PlacedItem[];
  expandWidgets(original);
  assert.deepEqual(original, copy);
  assert.equal(original[0].type, "Widget");
});

test("primitive-only seed is unchanged by expand", () => {
  const next = expandDocumentDefinition(TAX_INVOICE_SEED);
  assert.equal(next.items.length, TAX_INVOICE_SEED.items.length);
  assert.ok(next.items.every((i) => i.type !== "Widget"));
  assert.equal(
    next.items.find((i) => i.id === "lines")?.binding?.path,
    "lines"
  );
});

test("expand doc.totals includes Subtotal / GST / Grand Total labels", () => {
  const expanded = expandWidgets([
    widget("w_tot", "doc.totals", { x: 300, y: 500, width: 215, height: 80 }),
  ]);
  const labels = (expanded[0].children ?? [])
    .filter((c) => c.type === "Text")
    .map((c) => String(c.properties?.text ?? ""));
  assert.deepEqual(labels, ["Subtotal", "GST", "Grand Total"]);
});

test("seller fields stretch to widget width", () => {
  const expanded = expandWidgets([
    widget("w_seller", "doc.seller", { x: 10, y: 20, width: 300, height: 90 }),
  ]);
  const name = expanded[0].children?.find((c) => c.binding?.path === "seller.name");
  assert.ok(name);
  assert.equal(name.placement.width, 300);
  assert.equal(expanded[0].placement.x, 10);
});

test("widget definition still contains Widget after expand of a copy", () => {
  const def: DocumentDefinition = {
    name: "Blank",
    documentType: "INVOICE",
    page: { size: "A4" },
    items: [widget("w_logo", "doc.logo", { x: 0, y: 0, width: 120, height: 48 })],
  };
  expandDocumentDefinition(def);
  assert.equal(def.items[0].type, "Widget");
});
