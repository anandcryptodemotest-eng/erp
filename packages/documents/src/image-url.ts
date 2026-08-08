/** Shared helpers for Logo / Image URL resolution and size guidance. */

export type LogoSizePreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

/** Placement box sizes in document points (≈ CSS px at 72dpi on A4). */
export const LOGO_SIZE_PRESETS: LogoSizePreset[] = [
  { id: "compact", label: "Compact 80×32", width: 80, height: 32 },
  { id: "standard", label: "Standard 120×48", width: 120, height: 48 },
  { id: "wide", label: "Wide 160×48", width: 160, height: 48 },
  { id: "square", label: "Square 64×64", width: 64, height: 64 },
  { id: "square_lg", label: "Square 96×96", width: 96, height: 96 },
];

/** Recommended source image pixels for crisp print/PDF (≈2× box, min for clarity). */
export function recommendedLogoPixels(boxW: number, boxH: number): { w: number; h: number; printW: number; printH: number } {
  return {
    w: Math.round(boxW * 2),
    h: Math.round(boxH * 2),
    // ~300dpi relative to 72pt: box * (300/72) ≈ 4.17×
    printW: Math.round(boxW * 4),
    printH: Math.round(boxH * 4),
  };
}

/**
 * Resolve image URL for Logo/Image:
 * 1) payload binding path (runtime tenant logo)
 * 2) properties.src (template static image)
 * 3) binding.fallback
 */
export function resolveImageUrl(
  item: { binding?: { path?: string; fallback?: string }; properties?: Record<string, unknown> },
  payload: Record<string, unknown>,
  getByPath: (payload: Record<string, unknown>, path: string) => unknown
): string {
  if (item.binding?.path) {
    const raw = getByPath(payload, item.binding.path);
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  const src = item.properties?.src;
  if (typeof src === "string" && src.trim()) return src.trim();
  const fallback = item.binding?.fallback;
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  return "";
}
