import { createHash } from "node:crypto";
import type { FormDefinition } from "../types/definition";

/**
 * Normalize FormDefinition for starter-upgrade hashing.
 * Strips non-semantic / environment-varying metadata so harmless drift
 * does not mark a tenant form as customized.
 */
export function normalizeFormDefinitionForHash(def: FormDefinition): unknown {
  const fields = (def.fields ?? []).map((f) => {
    const out: Record<string, unknown> = {
      key: f.key,
      label: f.label,
      type: f.type,
      scope: f.scope ?? "order",
    };
    if (f.required) out.required = true;
    if (f.source) out.source = f.source;
    if (f.options?.length) {
      out.options = f.options.map((o) => ({ value: o.value, label: o.label }));
    }
    return out;
  });

  const layout = (def.layout ?? []).map((w) => ({
    widget: w.widget,
    props: sortKeys(w.props ?? {}),
  }));

  const body: Record<string, unknown> = {
    id: def.id ?? def.key,
    key: def.key,
    title: def.title ?? "",
    description: def.description ?? "",
    themeId: def.themeId ?? def.theme ?? "oms-default",
    confirmLabel: def.confirmLabel ?? "",
    fields,
    layout,
  };
  if (def.audiences?.length) body.audiences = [...def.audiences].sort();
  if (def.showTotal) body.showTotal = true;
  if (def.renderer) body.renderer = def.renderer;

  return sortKeys(body);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      const v = obj[k];
      if (v === undefined) continue;
      out[k] = sortKeys(v);
    }
    return out;
  }
  return value;
}

export function hashFormDefinition(def: FormDefinition): string {
  const normalized = normalizeFormDefinitionForHash(def);
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export type StarterUpgradeStatus = "eligible" | "already-current" | "customized" | "missing";

/**
 * Classify a published form body against known starter revision hashes.
 * latestRevision hashes → already-current
 * any prior known hash → eligible
 * unknown → customized
 */
export function classifyStarterFormHash(
  publishedHash: string | null,
  revisionHashes: Record<number, string>,
  latestRevision: number
): StarterUpgradeStatus {
  if (!publishedHash) return "missing";
  const latestHash = revisionHashes[latestRevision];
  if (latestHash && publishedHash === latestHash) return "already-current";
  for (const [rev, hash] of Object.entries(revisionHashes)) {
    if (Number(rev) === latestRevision) continue;
    if (hash === publishedHash) return "eligible";
  }
  return "customized";
}
