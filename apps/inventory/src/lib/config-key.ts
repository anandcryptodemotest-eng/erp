/** Normalize a single identity attribute value for configKey segments. */
export function normalizeIdentityValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/×/g, "X")
    .replace(/[^A-Z0-9._-]+/g, "");
}

/**
 * Build stable business identity key from ordered identity attribute keys.
 * Format: key1=VAL1|key2=VAL2 (order follows identityKeys).
 */
export function buildProductConfigKey(
  identityKeys: string[],
  attrs: Record<string, unknown>
): string | null {
  if (!identityKeys.length) return null;
  const parts: string[] = [];
  for (const key of identityKeys) {
    const raw = attrs[key];
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      return null;
    }
    const normalized = normalizeIdentityValue(raw);
    if (!normalized) return null;
    parts.push(`${key}=${normalized}`);
  }
  return parts.join("|");
}

/** True if identity attribute values differ between two attr maps. */
export function identityAttrsChanged(
  identityKeys: string[],
  before: Record<string, unknown>,
  after: Record<string, unknown>
): boolean {
  for (const key of identityKeys) {
    if (normalizeIdentityValue(before[key]) !== normalizeIdentityValue(after[key])) {
      return true;
    }
  }
  return false;
}
