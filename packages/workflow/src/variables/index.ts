/** Mutable workflow variable store helpers (instance.variables is the persistence target). */

export function getVariable<T = unknown>(
  variables: Record<string, unknown>,
  path: string,
  fallback?: T
): T | undefined {
  const parts = path.split(".");
  let cur: unknown = variables;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return fallback;
    cur = (cur as Record<string, unknown>)[p];
  }
  return (cur as T) ?? fallback;
}

export function setVariable(
  variables: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const parts = path.split(".");
  const next = { ...variables };
  let cur: Record<string, unknown> = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!;
    const child = cur[p];
    const obj =
      child != null && typeof child === "object" && !Array.isArray(child)
        ? { ...(child as Record<string, unknown>) }
        : {};
    cur[p] = obj;
    cur = obj;
  }
  cur[parts[parts.length - 1]!] = value;
  return next;
}

export function mergeVariables(
  base: Record<string, unknown>,
  patch?: Record<string, unknown>
): Record<string, unknown> {
  if (!patch) return { ...base };
  return { ...base, ...patch };
}
