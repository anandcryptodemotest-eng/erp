import type { UIRuntime, ValidationResult } from "./types";
import { getWidget } from "./registry";
import { normalizeScreenDefinition } from "./screen";

export function validateScreen(runtime: UIRuntime): ValidationResult {
  const screen = normalizeScreenDefinition(runtime.context.screen);
  const errors: string[] = [];
  for (const ref of screen.layout ?? []) {
    const reg = getWidget(ref.widget);
    if (!reg) {
      errors.push(`Unknown widget: ${ref.widget}`);
      continue;
    }
    if (!reg.manifest.supportsValidation) continue;
    const widget = reg.factory();
    const r = widget.validate(runtime, ref.props ?? {});
    if (!r.ok) errors.push(...(r.errors ?? [`${ref.widget} invalid`]));
  }
  return { ok: errors.length === 0, errors };
}

export function collectScreenPayload(runtime: UIRuntime): Record<string, unknown> {
  const screen = normalizeScreenDefinition(runtime.context.screen);
  const merged: Record<string, unknown> = {};
  for (const ref of screen.layout ?? []) {
    const reg = getWidget(ref.widget);
    if (!reg?.manifest.supportsPayload) continue;
    const widget = reg.factory();
    const partial = widget.collectPayload(runtime, ref.props ?? {});
    Object.assign(merged, partial);
  }
  return merged;
}
