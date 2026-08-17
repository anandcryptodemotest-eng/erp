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

test("catalog has the six print widgets including doc.qr", () => {
  assert.deepEqual(
    PRINT_WIDGET_CATALOG.map((w) => w.id),
    ["doc.logo", "doc.seller", "doc.buyer", "doc.lineItems", "doc.totals", "doc.qr"]
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

test("primitive seed expands doc.qr without a UPI default path", () => {
  const next = expandDocumentDefinition(TAX_INVOICE_SEED);
  const pay = TAX_INVOICE_SEED.items.find((i) => i.id === "payQr");
  assert.equal(pay?.type, "Widget");
  assert.equal(pay?.widgetId, "doc.qr");
  assert.equal((pay?.widgetConfig as { path?: string })?.path, "payment.upiUri");
  const expanded = next.items.find((i) => i.id === "payQr");
  assert.ok(expanded);
  assert.notEqual(expanded?.type, "Widget");
  const qr = expanded?.type === "QR" ? expanded : expanded?.children?.find((c) => c.type === "QR");
  assert.equal(qr?.binding?.path, "payment.upiUri");
});

test("expand doc.qr has no default path", () => {
  const expanded = expandWidgets([widget("w_qr", "doc.qr", { x: 0, y: 0, width: 72, height: 72 })]);
  assert.equal(expanded[0].type, "QR");
  assert.equal(expanded[0].binding?.path, undefined);
  assert.equal(expanded[0].properties?.text, undefined);
});

test("expand doc.qr uses widgetConfig path and caption — not payment.upiUri by default", () => {
  const item = widget("w_qr", "doc.qr", { x: 10, y: 20, width: 72, height: 88 });
  item.widgetConfig = { path: "some.payload", caption: "Scan" };
  const expanded = expandWidgets([item]);
  assert.equal(expanded[0].type, "Container");
  const qr = expanded[0].children?.find((c) => c.type === "QR");
  assert.equal(qr?.binding?.path, "some.payload");
  const caption = expanded[0].children?.find((c) => c.type === "Text");
  assert.equal(caption?.properties?.text, "Scan");
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
