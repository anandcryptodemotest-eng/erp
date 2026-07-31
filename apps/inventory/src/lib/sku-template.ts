export const MAX_SKU_LENGTH = 64;
export const MAX_PRODUCT_NAME_LENGTH = 200;

/** Expand placeholders like {grade}, {brand}, {thickness_mm} in a SKU template. */
export function expandSkuTemplate(
  template: string,
  tokens: Record<string, unknown>
): { sku: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const sku = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const raw = tokens[key];
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      unresolved.push(key);
      return "";
    }
    return String(raw)
      .trim()
      .toUpperCase()
      .replace(/×/g, "X")
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 16);
  });
  const cleaned = sku.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return { sku: cleaned, unresolved };
}

/** Fallback SKU from identity attrs when no template. */
export function fallbackSkuFromAttrs(
  prefix: string,
  attrs: Record<string, string>,
  orderedKeys: string[]
): string {
  const parts = orderedKeys
    .map((k) => attrs[k])
    .filter(Boolean)
    .map((v) =>
      String(v)
        .toUpperCase()
        .replace(/×/g, "X")
        .replace(/[^A-Z0-9]+/g, "")
        .slice(0, 12)
    )
    .filter(Boolean);
  const base = [prefix, ...parts].filter(Boolean).join("-");
  return base.slice(0, MAX_SKU_LENGTH);
}

export function buildGeneratedName(
  definitionName: string,
  attrs: Record<string, string>,
  orderedKeys: string[]
): string {
  const parts = orderedKeys.map((k) => attrs[k]).filter(Boolean);
  const name = parts.length ? `${definitionName} ${parts.join(" / ")}` : definitionName;
  return name.slice(0, MAX_PRODUCT_NAME_LENGTH);
}
