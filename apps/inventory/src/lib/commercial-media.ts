/**
 * Commercial media → Product.imageUrls (v1 denormalized projection).
 *
 * Precedence (never reverse):
 *   1. Variant / configuration image (media.variation lookup)
 *   2. SKU imageUrls
 *   3. Group aggregate images
 *   4. Explicit fallback images
 *
 * Variation keys follow variation.attributes order — never alphabetical sort.
 * Always build keys via buildVariationKey — never hand-concatenate "a|b|c".
 */

export type MediaVariation = {
  type: "CONFIGURATION";
  /** Ordered; key segments follow this order */
  attributes: string[];
  /** Key order matches attributes array — e.g. "Blue" or later "Blue|128" */
  values: Record<string, string[]>;
};

export type CommercialMedia = {
  images?: string[];
  variation?: MediaVariation | null;
};

export function normalizeMediaKeyPart(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Deterministic variation key from attribute order as stored — never sort.
 * Use this everywhere (seed, create engine, resolve) instead of string templates.
 */
export function buildVariationKey(
  attributeOrder: string[],
  values: Record<string, string | number | undefined | null>
): string {
  return attributeOrder.map((a) => String(values[a] ?? "").trim()).join("|");
}

/** @deprecated Prefer buildVariationKey — same implementation. */
export function mediaKey(attrs: Record<string, string>, attributes: string[]): string {
  return buildVariationKey(attributes, attrs);
}

export function lookupUrls(
  values: Record<string, string[]>,
  key: string
): string[] | undefined {
  const exact = values[key];
  if (Array.isArray(exact) && exact.length) return exact.filter(Boolean);

  const norm = normalizeMediaKeyPart(key);
  for (const [k, v] of Object.entries(values)) {
    if (normalizeMediaKeyPart(k) === norm && Array.isArray(v) && v.length) {
      return v.filter(Boolean);
    }
  }
  return undefined;
}

/**
 * Resolve images for one generated row at create time:
 * variation match → media.images fallback.
 */
export function resolveRowImageUrls(
  media: CommercialMedia | null | undefined,
  rowAttrs: Record<string, string>
): string[] {
  const fallback = Array.isArray(media?.images) ? media!.images!.filter(Boolean) : [];
  const variation = media?.variation;
  if (
    variation?.type === "CONFIGURATION" &&
    Array.isArray(variation.attributes) &&
    variation.attributes.length > 0
  ) {
    const key = buildVariationKey(variation.attributes, rowAttrs);
    return lookupUrls(variation.values ?? {}, key) ?? fallback;
  }
  return fallback;
}

/**
 * Runtime display precedence helper (SKU already stores variation projection).
 * Callers pass whatever layers they have; first non-empty wins.
 */
export function resolveProductImageUrls(layers: {
  variantUrls?: string[] | null;
  skuImageUrls?: string[] | null;
  groupImageUrls?: string[] | null;
  fallbackUrls?: string[] | null;
}): string[] {
  for (const layer of [
    layers.variantUrls,
    layers.skuImageUrls,
    layers.groupImageUrls,
    layers.fallbackUrls,
  ]) {
    const urls = (layer ?? []).filter((u): u is string => typeof u === "string" && u.trim().length > 0);
    if (urls.length) return urls;
  }
  return [];
}
