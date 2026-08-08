export { DocumentDesigner } from "./DocumentDesigner";
export type { DocumentDesignerProps } from "./DocumentDesigner";
export { canvasReducer, createInitialState, getPrimarySelected } from "./reducer";
export { snap, pageSize } from "./snap";
export { defaultItem, mergeItem } from "./defaultItem";
export { PALETTE } from "./types";
export type {
  CanvasState,
  DesignerCommand,
  GridSize,
  ResizeHandle,
  MoveItemsCommand,
  ResizeItemsCommand,
  UpdatePropertiesCommand,
  DeleteItemsCommand,
  CreateItemsCommand,
} from "./types";
