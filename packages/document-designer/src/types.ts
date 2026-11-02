import type { DocumentDefinition, DocumentItemType, PlacedItem } from "@erp/documents";

export type GridSize = 0 | 2 | 4 | 8 | 16;

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export type CanvasState = {
  definition: DocumentDefinition;
  selectedIds: Set<string>;
  gridSize: GridSize;
  /** Active layer id — v1 always "default". */
  activeLayerId: string;
};

export type MoveItemsCommand = {
  type: "MoveItems";
  ids: string[];
  dx: number;
  dy: number;
};

export type ResizeItemsCommand = {
  type: "ResizeItems";
  id: string;
  handle: ResizeHandle;
  dx: number;
  dy: number;
};

export type UpdatePropertiesCommand = {
  type: "UpdateProperties";
  id: string;
  patch: Partial<PlacedItem>;
};

export type DeleteItemsCommand = {
  type: "DeleteItems";
  ids: string[];
};

export type CreateItemsCommand = {
  type: "CreateItems";
  items: PlacedItem[];
  parentId: string | null;
};

export type SetSelectionCommand = {
  type: "SetSelection";
  ids: string[];
  mode?: "replace" | "toggle" | "add";
};

export type SetGridCommand = {
  type: "SetGrid";
  gridSize: GridSize;
};

export type ReplaceDefinitionCommand = {
  type: "ReplaceDefinition";
  definition: DocumentDefinition;
};

export type DesignerCommand =
  | MoveItemsCommand
  | ResizeItemsCommand
  | UpdatePropertiesCommand
  | DeleteItemsCommand
  | CreateItemsCommand
  | SetSelectionCommand
  | SetGridCommand
  | ReplaceDefinitionCommand;

export type PaletteEntry = { type: DocumentItemType; label: string };

export type PaletteTileAction =
  | { kind: "item"; type: DocumentItemType }
  | { kind: "area"; area: "header" | "footer" }
  | { kind: "pageNumber" }
  | { kind: "qr" };

export type PaletteTile = {
  id: string;
  label: string;
  span?: "full" | "half";
  action: PaletteTileAction;
};

export type PaletteGroup = { id: string; label: string; tiles: PaletteTile[] };

/** Business catalog — no Seller/Buyer/Logo/QR. */
export const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: "content",
    label: "Content",
    tiles: [
      { id: "text", label: "Text", action: { kind: "item", type: "Text" } },
      { id: "field", label: "Field", action: { kind: "item", type: "Field" } },
      { id: "image", label: "Image", action: { kind: "item", type: "Image" } },
      { id: "table", label: "Table", action: { kind: "item", type: "Table" } },
    ],
  },
  {
    id: "layout",
    label: "Layout",
    tiles: [
      { id: "container", label: "Container", span: "full", action: { kind: "item", type: "Container" } },
      { id: "box", label: "Box", action: { kind: "item", type: "Box" } },
      { id: "line", label: "Line", action: { kind: "item", type: "Line" } },
    ],
  },
  {
    id: "document",
    label: "Document",
    tiles: [
      { id: "header", label: "Header", action: { kind: "area", area: "header" } },
      { id: "footer", label: "Footer", action: { kind: "area", area: "footer" } },
      { id: "pageNo", label: "Page No.", span: "full", action: { kind: "pageNumber" } },
    ],
  },
];

export const QR_TILE: PaletteTile = {
  id: "qr",
  label: "QR",
  span: "full",
  action: { kind: "qr" },
};

export function businessPaletteLabels(): string[] {
  return PALETTE_GROUPS.flatMap((g) => g.tiles.map((t) => t.label));
}

/** Flat item-type palette (tests / legacy). QR is not on the Business catalog. */
export const PALETTE: PaletteEntry[] = [
  { type: "Text", label: "Text" },
  { type: "Field", label: "Field" },
  { type: "Table", label: "Table" },
  { type: "Image", label: "Image" },
  { type: "Line", label: "Line" },
  { type: "Box", label: "Box" },
  { type: "Container", label: "Container" },
];

/** Labels that must never appear on the primary component palette (ADR 0018). */
export const FORBIDDEN_PALETTE_LABELS = [
  "Seller",
  "Buyer",
  "Line items",
  "Totals",
  "Student",
  "Patient",
  "GST",
  "Sales Order",
  "Invoice Total",
  "Invoice",
  "Logo",
  "QR",
];

export type WidgetPaletteEntry = { widgetId: string; label: string };

export const WIDGET_PALETTE: WidgetPaletteEntry[] = [
  { widgetId: "doc.logo", label: "Logo" },
  { widgetId: "doc.seller", label: "Seller" },
  { widgetId: "doc.buyer", label: "Buyer" },
  { widgetId: "doc.lineItems", label: "Line items" },
  { widgetId: "doc.totals", label: "Totals" },
  { widgetId: "doc.qr", label: "QR" },
];

export type SimulateFeed = { kind: "sample" } | { kind: "invoice"; invoiceId: string };
