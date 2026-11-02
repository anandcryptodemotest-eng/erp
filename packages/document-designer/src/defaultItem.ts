import type { DocumentItemType, PlacedItem } from "@erp/documents";
import { generateItemId, printWidgetById, type PrintWidgetId } from "@erp/documents";

export function defaultWidgetItem(widgetId: PrintWidgetId): PlacedItem {
  const entry = printWidgetById(widgetId);
  const width = entry?.defaultPlacement.width ?? 150;
  const height = entry?.defaultPlacement.height ?? 48;
  return {
    id: generateItemId("widget"),
    name: entry?.label ?? widgetId,
    type: "Widget",
    widgetId,
    widgetConfig: {},
    placement: { x: 40, y: 40, width, height },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: 0,
    opacity: 1,
  };
}

export function defaultItem(type: DocumentItemType): PlacedItem {
  if (type === "Widget") return defaultWidgetItem("doc.logo");
  const id = generateItemId(type);
  const base: PlacedItem = {
    id,
    name: type,
    type,
    placement: { x: 40, y: 40, width: 150, height: 16 },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: 0,
    opacity: 1,
  };
  if (type === "Text") {
    base.name = "Text";
    base.properties = { text: "Text" };
  }
  if (type === "Field") {
    base.name = "Field";
    base.binding = { path: "", fallback: "" };
  }
  if (type === "Image" || type === "Logo") {
    base.name = type === "Logo" ? "Logo" : "Image";
    base.placement.height = 48;
    base.placement.width = 120;
    base.binding = { path: "", fallback: "" };
  }
  if (type === "QR") {
    base.name = "QR";
    base.placement.width = 64;
    base.placement.height = 64;
    base.binding = { path: "", fallback: "" };
    base.properties = { text: "" };
  }
  if (type === "Table") {
    base.name = "Table";
    base.placement.height = 80;
    base.placement.width = 300;
    base.binding = { path: "", fallback: "" };
    base.properties = { columns: [{ key: "description", label: "Description", width: 200 }] };
  }
  if (type === "Line") {
    base.name = "Line";
    base.placement.height = 2;
    base.placement.width = 200;
  }
  if (type === "Box") {
    base.name = "Box";
    base.placement.height = 80;
    base.placement.width = 160;
    base.style = { border: "1px solid #ccc", background: "transparent" };
  }
  if (type === "Container") {
    base.name = "Container";
    base.placement.height = 100;
    base.placement.width = 200;
    base.children = [];
  }
  return base;
}

/** Visual placeholder until BL-025 page tokens. Not a new DocumentItemType. */
export function defaultPageNumberItem(): PlacedItem {
  const item = defaultItem("Text");
  item.name = "Page number";
  item.properties = { text: "Page" };
  return item;
}

export function defaultAreaContainer(area: "header" | "footer"): PlacedItem {
  const isHeader = area === "header";
  return {
    id: generateItemId(area),
    name: isHeader ? "Header" : "Footer",
    type: "Container",
    placement: {
      area,
      x: 0,
      y: isHeader ? 0 : 720,
      width: 515,
      height: isHeader ? 72 : 60,
    },
    children: [],
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: 0,
    opacity: 1,
  };
}

export function invoiceStarterItems(): PlacedItem[] {
  const logo = defaultWidgetItem("doc.logo");
  logo.placement = { x: 0, y: 0, width: 120, height: 48 };
  const seller = defaultWidgetItem("doc.seller");
  seller.placement = { x: 0, y: 88, width: 250, height: 90 };
  const buyer = defaultWidgetItem("doc.buyer");
  buyer.placement = { x: 265, y: 88, width: 250, height: 90 };
  const lines = defaultWidgetItem("doc.lineItems");
  lines.placement = { x: 0, y: 200, width: 515, height: 80 };
  const totals = defaultWidgetItem("doc.totals");
  totals.placement = { x: 300, y: 284, width: 215, height: 72 };
  return [logo, seller, buyer, lines, totals];
}

export function mergeItem(item: PlacedItem, patch: Partial<PlacedItem>): PlacedItem {
  return {
    ...item,
    ...patch,
    placement: { ...item.placement, ...(patch.placement ?? {}) },
    style: patch.style ? { ...(item.style ?? {}), ...patch.style } : item.style,
    binding: patch.binding
      ? { ...(item.binding ?? { path: "" }), ...patch.binding }
      : item.binding,
    properties: patch.properties
      ? { ...(item.properties ?? {}), ...patch.properties }
      : item.properties,
    widgetConfig: patch.widgetConfig
      ? { ...(item.widgetConfig ?? {}), ...patch.widgetConfig }
      : item.widgetConfig,
  };
}
