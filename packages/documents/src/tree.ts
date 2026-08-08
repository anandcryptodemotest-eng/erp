import type { PlacedItem } from "./types";

/** Depth-first search for an item by id (including nested Container children). */
export function findItemById(items: PlacedItem[], id: string): PlacedItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children?.length) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Immutably replaces the item with `id`, applying `updater` to produce its next value. */
export function updateItemById(
  items: PlacedItem[],
  id: string,
  updater: (item: PlacedItem) => PlacedItem
): PlacedItem[] {
  return items.map((item) => {
    if (item.id === id) return updater(item);
    if (item.children?.length) {
      return { ...item, children: updateItemById(item.children, id, updater) };
    }
    return item;
  });
}

/** Immutably removes the item with `id` from anywhere in the tree. */
export function removeItemById(items: PlacedItem[], id: string): PlacedItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => (item.children?.length ? { ...item, children: removeItemById(item.children, id) } : item));
}

/** Immutably appends `newItem` as a child of the Container with `parentId`, or at the root when `parentId` is null. */
export function addItemToParent(
  items: PlacedItem[],
  parentId: string | null,
  newItem: PlacedItem
): PlacedItem[] {
  if (parentId == null) return [...items, newItem];
  return items.map((item) => {
    if (item.id === parentId) {
      return { ...item, children: [...(item.children ?? []), newItem] };
    }
    if (item.children?.length) {
      return { ...item, children: addItemToParent(item.children, parentId, newItem) };
    }
    return item;
  });
}

export type FlatItem = { id: string; type: string; depth: number };

/** Flattens the tree into an ordered outline list (id, type, nesting depth). */
export function flattenItems(items: PlacedItem[], depth = 0): FlatItem[] {
  const out: FlatItem[] = [];
  for (const item of items) {
    out.push({ id: item.id, type: item.type, depth });
    if (item.children?.length) out.push(...flattenItems(item.children, depth + 1));
  }
  return out;
}

let counter = 0;
/** Generates a short, human-readable unique id for a new item (e.g. "text_3"). */
export function generateItemId(type: string): string {
  counter += 1;
  return `${type.toLowerCase()}_${Date.now().toString(36).slice(-4)}${counter}`;
}
