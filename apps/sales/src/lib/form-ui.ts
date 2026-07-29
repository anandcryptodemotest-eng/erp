import type { FormDefinition } from "@erp/workflow";
import {
  resolveFormFromSnapshot,
  type WorkflowRuntimeSnapshot,
} from "@erp/workflow";

/** Map FormDefinition → OMS step UI (layout-driven). */
export function formDefinitionToStepUi(form: FormDefinition) {
  return {
    description: form.description,
    fields: form.fields,
    confirmLabel: form.confirmLabel,
    theme: form.theme,
    themeId: form.themeId,
    title: form.title,
    formId: form.id ?? form.key,
    layout: form.layout,
  };
}

export function resolveStepUiFromSnapshot(
  snapshot: unknown,
  stepKey: string
): ReturnType<typeof formDefinitionToStepUi> | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const snap = snapshot as WorkflowRuntimeSnapshot;
  const activity = snap.activities?.find((a) => a.key === stepKey);
  if (!activity) return null;
  const form = resolveFormFromSnapshot(snap, activity);
  if (!form) return null;
  return formDefinitionToStepUi(form);
}
