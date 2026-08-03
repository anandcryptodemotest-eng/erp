export function optionList(options: unknown): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map(String);
  if (typeof options === "object" && options !== null && Array.isArray((options as { values?: unknown }).values)) {
    return ((options as { values: unknown[] }).values).map(String);
  }
  return [];
}

export function formatPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

export function slugify(...parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("-")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function expandTemplate(template: string, tokens: Record<string, string>): string {
  let out = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const v = tokens[key];
    return v != null && String(v).trim() !== "" ? String(v).trim() : "";
  });
  out = out
    .replace(/\s+/g, " ")
    .replace(/(\d)\s+mm\b/gi, "$1mm")
    .replace(/^\s*mm\s+/i, "")
    .replace(/\s+mm\s*$/i, "")
    .replace(/\s+mm\s+/gi, " ")
    .trim();
  return out;
}

export function buildProgressiveTokens(
  brandName: string,
  categoryName: string,
  productName: string,
  selected: Record<string, string[]>,
  attrKeys: string[]
): Record<string, string> {
  const tokens: Record<string, string> = {
    brand: brandName,
    category: categoryName,
    productName,
  };
  for (const key of attrKeys) {
    const vals = selected[key] ?? [];
    if (vals.length === 1) {
      tokens[key] = vals[0]!;
      if (key === "thickness_mm") tokens.thickness = vals[0]!;
    }
  }
  return tokens;
}

export function defaultSkuPattern(attrKeys: string[]): string {
  const preferred = ["brand", "grade", "thickness_mm", "size"].filter(
    (k) => k === "brand" || attrKeys.includes(k)
  );
  const keys = preferred.length > 1 ? preferred : ["brand", ...attrKeys.slice(0, 3)];
  return keys.map((k) => `{${k}}`).join("-");
}

export function defaultNamePattern(attrKeys: string[]): string {
  const parts: string[] = ["{brand}"];
  if (attrKeys.includes("grade")) parts.push("{grade}");
  if (attrKeys.includes("thickness_mm")) parts.push("{thickness_mm}mm");
  else if (attrKeys.includes("thickness")) parts.push("{thickness}");
  if (attrKeys.includes("size")) parts.push("{size}");
  if (attrKeys.includes("color")) parts.push("{color}");
  if (attrKeys.includes("storage")) parts.push("{storage}");
  if (parts.length === 1) parts.push(...attrKeys.slice(0, 3).map((k) => `{${k}}`));
  return parts.join(" ");
}

export function defaultProductNameTemplate(attrKeys: string[]): string {
  const parts = ["{brand}"];
  if (attrKeys.includes("grade")) parts.push("{grade}");
  if (attrKeys.includes("thickness_mm")) parts.push("{thickness_mm}mm");
  if (attrKeys.includes("size")) parts.push("{size}");
  if (attrKeys.includes("color")) parts.push("{color}");
  if (attrKeys.includes("storage")) parts.push("{storage}");
  parts.push("{category}");
  return parts.join(" ") || "{brand} {grade} {thickness_mm}mm {size} {category}";
}

export const fieldClass =
  "mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20";

/** Explicit action button styles for Product Studio inline panels */
export const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-mid)] disabled:cursor-not-allowed disabled:opacity-45";

export const btnSecondary =
  "inline-flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--mist)] disabled:cursor-not-allowed disabled:opacity-45";

export const btnGhost =
  "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--mist)] hover:text-[var(--ink)] disabled:opacity-45";

export const btnOutlineBrand =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--brand)_35%,var(--line))] bg-[color-mix(in_srgb,var(--brand)_6%,var(--surface-raised))] px-3.5 py-2 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-[color-mix(in_srgb,var(--brand)_12%,var(--surface-raised))]";
