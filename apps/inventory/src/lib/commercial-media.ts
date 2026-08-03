/**
 * Commercial media → Product.imageUrls (v1 denormalized projection).
 * Variation keys follow variation.attributes order — never alphabetical sort.
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

/** Deterministic key from attribute order as stored — never sort. */
export function mediaKey(attrs: Record<string, string>, attributes: string[]): string {
  return attributes.map((a) => String(attrs[a] ?? "").trim()).join("|");
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

/** Always returns string[] — never undefined. */
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
    const key = mediaKey(rowAttrs, variation.attributes);
    return lookupUrls(variation.values ?? {}, key) ?? fallback;
  }
  return fallback;
}
