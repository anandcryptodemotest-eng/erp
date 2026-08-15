import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TAX_INVOICE_SEED,
  blankDocumentDefinition,
  listCollectionLeaves,
  INVOICE_BINDING_SCHEMA,
} from "@erp/documents";
import {
  FORBIDDEN_PALETTE_LABELS,
  PALETTE,
  PALETTE_GROUPS,
  QR_TILE,
  businessPaletteLabels,
} from "./types";
import {
  defaultAreaContainer,
  defaultItem,
  defaultPageNumberItem,
  invoiceStarterItems,
} from "./defaultItem";
import { createInitialState } from "./reducer";
import { GUIDED_STEPS, patchStudio, studioLevel } from "./studio-model";
import { alignPlacement } from "./layout";
import { fieldFromSchemaLeaf, tableFromCollection } from "./from-schema";

test("business palette is generic — no ERP or QR/Logo labels", () => {
  const labels = businessPaletteLabels();
  for (const forbidden of FORBIDDEN_PALETTE_LABELS) {
    assert.ok(!labels.includes(forbidden), `business palette must not include ${forbidden}`);
  }
  assert.deepEqual(labels, [
    "Text",
    "Field",
    "Image",
    "Table",
    "Container",
    "Box",
    "Line",
    "Header",
    "Footer",
    "Page No.",
  ]);
  assert.ok(!labels.includes("QR"));
  assert.equal(QR_TILE.label, "QR");
});

test("legacy PALETTE has no QR (Business item types)", () => {
  assert.ok(!PALETTE.some((p) => p.type === "QR"));
});

test("Container and Page No. span full palette width", () => {
  const layout = PALETTE_GROUPS.find((g) => g.id === "layout")!;
  const doc = PALETTE_GROUPS.find((g) => g.id === "document")!;
  assert.equal(layout.tiles.find((t) => t.label === "Container")?.span, "full");
  assert.equal(doc.tiles.find((t) => t.label === "Page No.")?.span, "full");
});

test("new Table is unbound — collection path comes from schema", () => {
  const table = defaultItem("Table");
  assert.equal(table.binding?.path, "");
});

test("new Image has empty binding, not seller.logoUrl", () => {
  const image = defaultItem("Image");
  assert.equal(image.type, "Image");
  assert.equal(image.binding?.path, "");
});

test("page number helper is Text placeholder, not a new type", () => {
  const item = defaultPageNumberItem();
  assert.equal(item.type, "Text");
  assert.equal(item.name, "Page number");
  assert.equal(item.properties?.text, "Page");
});

test("invoice starter is compositions, not palette", () => {
  const items = invoiceStarterItems();
  assert.equal(items.length, 5);
  assert.ok(items.every((i) => i.type === "Widget"));
  assert.deepEqual(
    items.map((i) => i.widgetId),
    ["doc.logo", "doc.seller", "doc.buyer", "doc.lineItems", "doc.totals"]
  );
});

test("guided steps are generic page sections", () => {
  const labels = GUIDED_STEPS.map((s) => s.label as string);
  assert.deepEqual(labels, ["Page", "Header", "Content", "Collections", "Summary", "Footer", "Preview"]);
});

test("patchStudio persists level without changing items", () => {
  const items = [{ ...defaultItem("Field"), id: "f1" }];
  const def = patchStudio(
    { name: "T", documentType: "INVOICE", page: { size: "A4" }, items },
    { level: "power", tab: "design" }
  );
  assert.equal(def.studio?.level, "power");
  assert.equal(studioLevel({ name: "X", documentType: "INVOICE", page: { size: "A4" }, items: [] }), "business");
  assert.equal(def.items, items);
});

test("header/footer containers use placement.area", () => {
  const h = defaultAreaContainer("header");
  const f = defaultAreaContainer("footer");
  assert.equal(h.placement.area, "header");
  assert.equal(f.placement.area, "footer");
  assert.equal(h.type, "Container");
});

test("invoice schema marks lines as a collection", () => {
  const cols = listCollectionLeaves(INVOICE_BINDING_SCHEMA);
  assert.equal(cols.length, 1);
  assert.equal(cols[0].path, "lines");
});

test("primitive tax-invoice seed still opens", () => {
  const state = createInitialState(TAX_INVOICE_SEED);
  assert.ok(state.definition.items.length > 0);
  assert.ok(state.definition.items.every((i) => i.type !== "Widget"));
});

test("blank document opens with empty canvas", () => {
  const state = createInitialState(blankDocumentDefinition({ id: "doc-blank" }));
  assert.equal(state.definition.items.length, 0);
  assert.equal(state.definition.studio?.level, "business");
});

test("alignPlacement snaps x on A4", () => {
  const page = { size: "A4" as const, margin: { top: 40, right: 40, bottom: 40, left: 40 } };
  const item = defaultItem("Field");
  item.placement.width = 100;
  const left = alignPlacement(item, page, "left");
  const center = alignPlacement(item, page, "center");
  const right = alignPlacement(item, page, "right");
  assert.equal(left.placement.x, 40);
  assert.equal(left.placement.align, "left");
  assert.equal(center.placement.x, (595 - 100) / 2);
  assert.equal(right.placement.x, 595 - 40 - 100);
});

test("fieldFromSchemaLeaf uses schema label and path", () => {
  const field = fieldFromSchemaLeaf({ path: "invoice.number", label: "Number" });
  assert.equal(field.type, "Field");
  assert.equal(field.name, "Number");
  assert.equal(field.binding?.path, "invoice.number");
  const table = tableFromCollection({ path: "lines", label: "Line items (table)", collection: true });
  assert.equal(table.type, "Table");
  assert.equal(table.binding?.path, "lines");
  assert.equal(table.name, "Line items");
});
