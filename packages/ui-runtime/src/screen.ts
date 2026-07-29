import type { FormDefinition } from "@erp/workflow";
import { formKeyToFormId, withFormId } from "@erp/workflow";
import type { FormWidgetRef, ScreenDefinition } from "./types";

/**
 * Ensure Screen has layout[{ widget, props }].
 * Greenfield: layout is required — no showItems / component synthesis.
 */
export function normalizeScreenDefinition(raw: FormDefinition | ScreenDefinition): ScreenDefinition {
  const form = withFormId(raw as FormDefinition);
  const themeId =
    (raw as ScreenDefinition).themeId ??
    (form.theme === "amber" ? "oms-attention" : form.theme === "emerald" ? "oms-default" : undefined) ??
    "oms-default";

  let layout = (raw as ScreenDefinition).layout ?? form.layout;
  if (!layout?.length) {
    throw new Error(
      `Screen "${form.id ?? form.key}" has no layout[]. Republish the form with layout widgets.`
    );
  }

  layout = layout.map((w) => normalizeWidgetRef(w as FormWidgetRef & Record<string, unknown>));

  return {
    ...form,
    id: form.id ?? formKeyToFormId(form.key),
    themeId,
    layout,
  };
}

function normalizeWidgetRef(w: FormWidgetRef & Record<string, unknown>): FormWidgetRef {
  if (w.props && typeof w.props === "object") {
    return { widget: w.widget, props: w.props };
  }
  const { widget, props: _p, ...rest } = w;
  return { widget, props: Object.keys(rest).length ? rest : {} };
}

export function screenThemeId(screen: ScreenDefinition): string {
  return screen.themeId ?? (screen.theme === "amber" ? "oms-attention" : "oms-default");
}
