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

export const PALETTE: PaletteEntry[] = [
  { type: "Text", label: "Text" },
  { type: "Field", label: "Field" },
  { type: "Table", label: "Table" },
  { type: "Logo", label: "Logo" },
  { type: "QR", label: "QR" },
  { type: "Line", label: "Line" },
  { type: "Box", label: "Box" },
  { type: "Container", label: "Container" },
];
