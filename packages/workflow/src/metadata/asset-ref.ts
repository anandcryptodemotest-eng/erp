import type {
  ActivityDefinition,
  AssetRef,
  AssetType,
  FormDefinition,
  WorkflowDefinition,
  WorkflowRuntimeSnapshot,
} from "../types/definition";

/** Stable map key for pinned / catalog lookups */
export function assetKey(ref: Pick<AssetRef, "type" | "id" | "version">): string {
  return `${ref.type}:${ref.id}@${ref.version}`;
}

export function parseAssetKey(key: string): AssetRef | null {
  const m = /^([A-Z_]+):([^@]+)@(\d+)$/.exec(key);
  if (!m) return null;
  return { type: m[1] as AssetType, id: m[2], version: Number(m[3]) };
}

/** Normalize legacy formKey → AssetRef (version must be supplied by caller / catalog). */
export function formKeyToAssetRef(formKey: string, version: number): AssetRef {
  return { type: "FORM", id: formKeyToFormId(formKey), version };
}

/** sales_review_form → sales-review; inventory_form → inventory */
export function formKeyToFormId(formKey: string): string {
  const base = formKey.replace(/_form$/, "");
  return base.replace(/_/g, "-");
}

export function formIdToLegacyKey(formId: string): string {
  if (formId.endsWith("_form") || formId.includes("_")) return formId;
  return `${formId.replace(/-/g, "_")}_form`;
}

export function activityFormRef(activity: ActivityDefinition): AssetRef | null {
  if (activity.assetRef?.type === "FORM" && activity.assetRef.id && activity.assetRef.version >= 1) {
    return activity.assetRef;
  }
  return null;
}

/**
 * Resolve FORM definition for an activity from a runtime snapshot.
 * Order: pinnedAssets → forms[] by assetRef.id / formKey → null
 */
export function resolveFormFromSnapshot(
  snapshot: WorkflowRuntimeSnapshot | WorkflowDefinition,
  activity: ActivityDefinition
): FormDefinition | null {
  const snap = snapshot as WorkflowRuntimeSnapshot;
  const ref = activityFormRef(activity);
  if (ref && snap.pinnedAssets) {
    const pinned = snap.pinnedAssets[assetKey(ref)];
    if (pinned?.body && typeof pinned.body === "object") {
      return pinned.body as FormDefinition;
    }
  }
  const forms = snap.forms ?? [];
  if (ref) {
    const byId =
      forms.find((f) => (f.id ?? formKeyToFormId(f.key)) === ref.id) ??
      forms.find((f) => f.key === ref.id);
    if (byId) return byId;
  }
  return null;
}

/** Collect FORM AssetRefs from a definition (concrete versions only). */
export function collectFormAssetRefs(def: WorkflowDefinition): AssetRef[] {
  const out: AssetRef[] = [];
  const seen = new Set<string>();
  for (const a of def.activities) {
    const ref = activityFormRef(a);
    if (!ref) continue;
    const k = assetKey(ref);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(ref);
  }
  return out;
}

/** Ensure FormDefinition has catalog id */
export function withFormId(form: FormDefinition): FormDefinition {
  const id = form.id ?? formKeyToFormId(form.key);
  const renderer =
    form.renderer ?? (form.component ? ("custom" as const) : ("generic" as const));
  return { ...form, id, renderer };
}
