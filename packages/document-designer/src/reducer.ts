import type { DocumentDefinition, PlacedItem } from "@erp/documents";
import {
  addItemToParent,
  findItemById,
  removeItemById,
  updateItemById,
} from "@erp/documents";
import { mergeItem } from "./defaultItem";
import type { CanvasState, DesignerCommand, ResizeHandle } from "./types";

export function createInitialState(definition: DocumentDefinition): CanvasState {
  return {
    definition,
    selectedIds: new Set(),
    gridSize: 4,
    activeLayerId: "default",
  };
}

function movePlacement(item: PlacedItem, dx: number, dy: number): PlacedItem {
  if (item.locked) return item;
  return {
    ...item,
    placement: {
      ...item.placement,
      x: item.placement.x + dx,
      y: item.placement.y + dy,
    },
  };
}

function resizePlacement(
  item: PlacedItem,
  handle: ResizeHandle,
  dx: number,
  dy: number
): PlacedItem {
  if (item.locked) return item;
  let { x, y, width, height = 16 } = item.placement;
  const min = 8;

  switch (handle) {
    case "e":
      width = Math.max(min, width + dx);
      break;
    case "w":
      width = Math.max(min, width - dx);
      x = x + dx;
      break;
    case "s":
      height = Math.max(min, height + dy);
      break;
    case "n":
      height = Math.max(min, height - dy);
      y = y + dy;
      break;
    case "se":
      width = Math.max(min, width + dx);
      height = Math.max(min, height + dy);
      break;
    case "sw":
      width = Math.max(min, width - dx);
      x = x + dx;
      height = Math.max(min, height + dy);
      break;
    case "ne":
      width = Math.max(min, width + dx);
      height = Math.max(min, height - dy);
      y = y + dy;
      break;
    case "nw":
      width = Math.max(min, width - dx);
      x = x + dx;
      height = Math.max(min, height - dy);
      y = y + dy;
      break;
  }

  return {
    ...item,
    placement: { ...item.placement, x, y, width, height },
  };
}

/** Move only the targeted items; Container children keep local coords (Figma frames). */
function moveItemsInTree(
  items: PlacedItem[],
  ids: Set<string>,
  dx: number,
  dy: number
): PlacedItem[] {
  return items.map((item) => {
    let next = item;
    if (ids.has(item.id)) {
      next = movePlacement(item, dx, dy);
    }
    if (next.children?.length) {
      // Children are local — only move them if they themselves are selected,
      // not because the parent moved (parent move already shifts the frame).
      next = {
        ...next,
        children: moveItemsInTree(next.children, ids, dx, dy),
      };
    }
    return next;
  });
}

export function canvasReducer(state: CanvasState, command: DesignerCommand): CanvasState {
  switch (command.type) {
    case "SetSelection": {
      const next = new Set(state.selectedIds);
      if (command.mode === "toggle") {
        for (const id of command.ids) {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
      } else if (command.mode === "add") {
        for (const id of command.ids) next.add(id);
      } else {
        return { ...state, selectedIds: new Set(command.ids) };
      }
      return { ...state, selectedIds: next };
    }

    case "SetGrid":
      return { ...state, gridSize: command.gridSize };

    case "ReplaceDefinition":
      return {
        ...state,
        definition: command.definition,
        selectedIds: new Set(),
      };

    case "MoveItems": {
      const ids = new Set(command.ids);
      const items = moveItemsInTree(
        state.definition.items,
        ids,
        command.dx,
        command.dy
      );
      return { ...state, definition: { ...state.definition, items } };
    }

    case "ResizeItems": {
      const items = updateItemById(state.definition.items, command.id, (item) =>
        resizePlacement(item, command.handle, command.dx, command.dy)
      );
      return { ...state, definition: { ...state.definition, items } };
    }

    case "UpdateProperties": {
      const items = updateItemById(state.definition.items, command.id, (item) =>
        mergeItem(item, command.patch)
      );
      return { ...state, definition: { ...state.definition, items } };
    }

    case "DeleteItems": {
      let items = state.definition.items;
      for (const id of command.ids) {
        items = removeItemById(items, id);
      }
      const selectedIds = new Set(
        [...state.selectedIds].filter((id) => !command.ids.includes(id))
      );
      return {
        ...state,
        definition: { ...state.definition, items },
        selectedIds,
      };
    }

    case "CreateItems": {
      let items = state.definition.items;
      const createdIds: string[] = [];
      for (const item of command.items) {
        items = addItemToParent(items, command.parentId, item);
        createdIds.push(item.id);
      }
      return {
        ...state,
        definition: { ...state.definition, items },
        selectedIds: new Set(createdIds),
      };
    }

    default:
      return state;
  }
}

export function getPrimarySelected(
  state: CanvasState
): PlacedItem | undefined {
  const id = state.selectedIds.values().next().value as string | undefined;
  if (!id) return undefined;
  return findItemById(state.definition.items, id);
}
