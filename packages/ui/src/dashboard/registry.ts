import type { DashboardPortal, DashboardPlacement, ResolvedWidget, WidgetDefinition, DashboardAuthContext } from "./types";
import { authorizeWidget } from "./types";

const registry = new Map<string, WidgetDefinition>();

export function registerWidget(def: WidgetDefinition): void {
  registry.set(def.id, def);
}

export function getWidget(id: string): WidgetDefinition | undefined {
  return registry.get(id);
}

export function listWidgets(): WidgetDefinition[] {
  return [...registry.values()];
}

/**
 * Resolve a set of placements into renderable widgets, applying the
 * server-side authorization model: module gate + optional capability gate.
 * Unauthorized or unknown widgets are dropped (never rendered).
 */
export function resolveWidgets(
  placements: DashboardPlacement[],
  auth: DashboardAuthContext,
  portal: DashboardPortal
): ResolvedWidget[] {
  const out: ResolvedWidget[] = [];
  for (const p of placements) {
    const def = registry.get(p.type);
    if (!def) continue; // unknown widget — drop
    if (!authorizeWidget(def, auth)) continue; // unauthorized — drop
    out.push({ ...p, definition: def });
  }
  return out;
}

/** Widgets the user is allowed to add (catalog for the editor picker). */
export function allowedWidgets(auth: DashboardAuthContext, portal: DashboardPortal): WidgetDefinition[] {
  return listWidgets().filter((w) => authorizeWidget(w, auth));
}