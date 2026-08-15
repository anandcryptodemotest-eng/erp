import type { DocumentPage, PlacedItem } from "@erp/documents";
import { pageSize } from "./snap";

export type AlignPreset = "left" | "center" | "right";
export type SpacingPreset = "small" | "medium" | "large";

const SPACING_PAD: Record<SpacingPreset, number> = {
  small: 4,
  medium: 8,
  large: 16,
};

export function defaultPageMargin(page: DocumentPage): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  return page.margin ?? { top: 40, right: 40, bottom: 40, left: 40 };
}

/** Snap block X to left / center / right of the page. Also sets placement.align + style.textAlign. */
export function alignPlacement(
  item: PlacedItem,
  page: DocumentPage,
  align: AlignPreset
): PlacedItem {
  const { width: pw } = pageSize(page.size);
  const margin = defaultPageMargin(page);
  const w = item.placement.width;
  let x = item.placement.x;
  if (align === "left") x = margin.left;
  if (align === "center") x = (pw - w) / 2;
  if (align === "right") x = pw - margin.right - w;
  return {
    ...item,
    placement: { ...item.placement, x, align },
    style: { ...item.style, textAlign: align },
  };
}

export function spacingPadding(preset: SpacingPreset): number {
  return SPACING_PAD[preset];
}

export function spacingFromPadding(padding: unknown): SpacingPreset | null {
  const n = typeof padding === "number" ? padding : Number(padding);
  if (n === 4) return "small";
  if (n === 8) return "medium";
  if (n === 16) return "large";
  return null;
}
