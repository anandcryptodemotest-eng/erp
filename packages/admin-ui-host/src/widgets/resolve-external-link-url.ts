export type ExternalLinkResolveProps = {
  url?: unknown;
  urlFromVariable?: unknown;
};

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Resolve the button target URL.
 * Variable (when configured and non-empty) wins; otherwise props.url.
 */
export function resolveExternalLinkUrl(
  props: ExternalLinkResolveProps,
  variables: Record<string, unknown> = {}
): string {
  const varKey = asTrimmedString(props.urlFromVariable);
  if (varKey) {
    const fromVar = asTrimmedString(variables[varKey]);
    if (fromVar) return fromVar;
  }
  return asTrimmedString(props.url);
}

/** Accept http(s) absolute URLs only — keeps window.open from running javascript: etc. */
export function isValidExternalLinkUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function coerceOpenInNewTab(value: unknown, defaultValue = true): boolean {
  if (typeof value === "boolean") return value;
  if (value === "false" || value === "0") return false;
  if (value === "true" || value === "1") return true;
  if (value === undefined || value === null || value === "") return defaultValue;
  return Boolean(value);
}
