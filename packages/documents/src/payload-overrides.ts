import type { DocumentBindingSchema } from "./types";
import { bindingSchemaForDocumentType } from "./binding-schema";

/** All leaf paths exposed by a binding schema (authors may only use these). */
export function listBindingSchemaPaths(schema: DocumentBindingSchema): string[] {
  const out: string[] = [];
  for (const g of schema.groups) {
    for (const f of g.fields) out.push(f.path);
  }
  return out;
}

export function setByPath(target: Record<string, unknown>, path: string, value: unknown): void {
  if (!path) return;
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = cur[key];
    if (next == null || typeof next !== "object" || Array.isArray(next)) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

export type PayloadOverride = { fieldKey: string; path: string };

/**
 * Merge form values into payload at schema-allowed paths.
 * Returns list of validation errors (empty = ok).
 */
export function applyPayloadOverrides(
  payload: Record<string, unknown>,
  overrides: PayloadOverride[] | undefined,
  formValues: Record<string, string> | undefined,
  documentType = "INVOICE"
): string[] {
  if (!overrides?.length) return [];
  const allowed = new Set(listBindingSchemaPaths(bindingSchemaForDocumentType(documentType)));
  const errors: string[] = [];
  for (const o of overrides) {
    if (!o.path || !o.fieldKey) {
      errors.push("payloadOverrides entries require fieldKey and path");
      continue;
    }
    if (!allowed.has(o.path)) {
      errors.push(`Unknown binding path "${o.path}" — extend the payload builder and binding schema`);
      continue;
    }
    const raw = formValues?.[o.fieldKey];
    if (raw === undefined) continue;
    setByPath(payload, o.path, raw);
  }
  return errors;
}
