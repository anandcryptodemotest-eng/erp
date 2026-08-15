import type { BindingSchemaLeaf, DocumentDefinition, PlacedItem } from "@erp/documents";
import { defaultItem } from "./defaultItem";

function walkItems(items: PlacedItem[]): PlacedItem[] {
  return items.flatMap((i) => [i, ...(i.children ? walkItems(i.children) : [])]);
}

export function nextPlacementY(def: DocumentDefinition, area?: "header" | "footer"): number {
  const items = walkItems(def.items).filter((i) =>
    area ? i.placement.area === area : !i.placement.area || i.placement.area === "body" || i.placement.area === "absolute"
  );
  if (items.length === 0) return area === "footer" ? 728 : area === "header" ? 8 : 40;
  return Math.max(...items.map((i) => i.placement.y + (i.placement.height ?? 16))) + 12;
}

export function fieldFromSchemaLeaf(
  leaf: BindingSchemaLeaf,
  extra?: { area?: "header" | "footer"; y?: number }
): PlacedItem {
  const item = defaultItem("Field");
  item.name = leaf.label;
  item.binding = {
    path: leaf.path,
    formatter: leaf.formatter,
    fallback: "",
  };
  if (extra?.area) item.placement.area = extra.area;
  if (extra?.y != null) item.placement.y = extra.y;
  return item;
}

export function tableFromCollection(leaf: BindingSchemaLeaf, y?: number): PlacedItem {
  const item = defaultItem("Table");
  item.name = leaf.label.replace(/\s*\(table\)\s*/i, "") || "Table";
  item.binding = { path: leaf.path, fallback: "" };
  item.placement.width = 515;
  item.placement.height = 160;
  if (y != null) item.placement.y = y;
  item.properties = {
    columns: [
      { key: "description", label: "Description", width: 220 },
      { key: "qty", label: "Qty", width: 48 },
      { key: "amount", label: "Amount", width: 80, formatter: "currency" },
    ],
  };
  return item;
}

export function titleTextItem(text: string, extra?: { area?: "header" | "footer"; y?: number }): PlacedItem {
  const item = defaultItem("Text");
  item.name = "Title";
  item.properties = { text };
  item.style = { fontSize: 16, fontWeight: "600" };
  item.placement.width = 280;
  item.placement.height = 22;
  if (extra?.area) item.placement.area = extra.area;
  if (extra?.y != null) item.placement.y = extra.y;
  return item;
}

export function notesTextItem(extra?: { area?: "header" | "footer"; y?: number }): PlacedItem {
  const item = defaultItem("Text");
  item.name = "Notes";
  item.properties = { text: "Notes" };
  if (extra?.area) item.placement.area = extra.area;
  if (extra?.y != null) item.placement.y = extra.y;
  return item;
}

export function addItemToDefinition(def: DocumentDefinition, item: PlacedItem): DocumentDefinition {
  return { ...def, items: [...def.items, item] };
}

export function itemNames(def: DocumentDefinition): string[] {
  return walkItems(def.items).map((i) => i.name || i.type);
}
