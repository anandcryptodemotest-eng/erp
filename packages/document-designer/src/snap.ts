import type { GridSize } from "./types";

export function snap(value: number, gridSize: GridSize): number {
  if (!gridSize || gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function pageSize(size: "A4" | "Letter"): { width: number; height: number } {
  if (size === "Letter") return { width: 612, height: 792 };
  return { width: 595, height: 842 };
}
