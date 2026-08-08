import type { DocumentItemType, PlacedItem } from "@erp/documents";
import { generateItemId } from "@erp/documents";

export function defaultItem(type: DocumentItemType): PlacedItem {
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
  if (type === "Logo") {
    base.name = "Logo";
    base.placement.height = 48;
    base.placement.width = 120;
    base.binding = { path: "seller.logoUrl", fallback: "" };
  }
  if (type === "QR") {
    base.name = "QR";
    base.placement.width = 64;
    base.placement.height = 64;
  }
  if (type === "Table") {
    base.name = "Table";
    base.placement.height = 120;
    base.placement.width = 300;
    base.binding = { path: "lines" };
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
  };
}
