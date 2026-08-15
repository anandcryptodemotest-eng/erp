/**
 * BL-039 — presentation-only dashboard ordering for Admin Mobile Ops.
 * Never mutates the input array or placement x/y/w/h.
 *
 * Priority is a small type→rank map here (not per-widget mobilePriority metadata).
 * Unknown types sort as secondary (stable). Charts are not hidden — only deprioritized.
 */

export type PresentationAdminMode = "operational" | "dense" | string;

export type PresentationViewport = "phone" | "tablet" | "desktop";

export type PresentationOptions = {
  adminMode?: PresentationAdminMode | null;
  viewport?: PresentationViewport | null;
};

/** Widget-like row that has a `type` (ResolvedWidget / placement). */
export type PresentationWidget = { type: string };

const PHONE_PRIORITY: Record<string, number> = {
  "my-tasks-list": 0,
  "ops-kpi-row": 1,
};

/**
 * Derive a render order without mutating `widgets`.
 * Phone + operational: my-tasks-list → ops-kpi-row → secondary (stable among peers).
 * Otherwise: shallow copy of input order.
 */
export function getPresentationWidgets<T extends PresentationWidget>(
  widgets: readonly T[],
  opts: PresentationOptions = {}
): T[] {
  const copy = widgets.slice();
  if (opts.adminMode !== "operational" || opts.viewport !== "phone") {
    return copy;
  }

  return copy.sort((a, b) => {
    const pa = PHONE_PRIORITY[a.type] ?? 100;
    const pb = PHONE_PRIORITY[b.type] ?? 100;
    if (pa !== pb) return pa - pb;
    // Stable relative to original: compare original indices
    return widgets.indexOf(a) - widgets.indexOf(b);
  });
}

/** Map CSS width to presentation viewport bucket. */
export function viewportFromWidth(width: number): PresentationViewport {
  if (width < 768) return "phone";
  if (width < 1024) return "tablet";
  return "desktop";
}
