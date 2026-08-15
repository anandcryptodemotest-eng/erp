/**
 * SO_STANDARD Business Work Items — presentation catalog (BL-035).
 * Engine activities stay granular; Order Desk uses these Work Items.
 * @see docs/SO-TASK-RATIONALIZATION.md
 */

export type WorkItemStatus =
  | "WAITING"
  | "READY"
  | "CLAIMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "HIDDEN";

export type SoWorkItemDef = {
  key: string;
  label: string;
  /** Activity keys in engine completion order */
  activityKeys: string[];
  /** Roles that see this Work Item in their queue */
  roleHints: string[];
  /** Hide when activity SKIPPED / not applicable (procurement) */
  conditional?: boolean;
};

/** Locked map from SO-TASK-RATIONALIZATION.md (2026-08-15). */
export const SO_STANDARD_WORK_ITEMS: readonly SoWorkItemDef[] = [
  {
    key: "confirm_order",
    label: "Confirm Order",
    activityKeys: ["sales_review"],
    roleHints: ["SALES_EXECUTIVE", "SALES_REP"],
  },
  {
    key: "check_stock",
    label: "Check Stock",
    activityKeys: ["inventory"],
    roleHints: ["SALES_EXECUTIVE", "SALES_REP"],
  },
  {
    key: "procurement_exception",
    label: "Procurement Exception",
    activityKeys: ["procurement"],
    roleHints: ["SALES_EXECUTIVE", "SALES_REP"],
    conditional: true,
  },
  {
    key: "pricing_review",
    label: "Pricing Review",
    activityKeys: ["pricing"],
    roleHints: ["PRICING_EXECUTIVE"],
  },
  {
    key: "dispatch_order",
    label: "Dispatch Order",
    activityKeys: ["warehouse", "dispatch"],
    roleHints: ["DISPATCH_EXECUTIVE"],
  },
  {
    key: "confirm_delivery",
    label: "Confirm Delivery",
    activityKeys: ["deliver"],
    roleHints: ["DELIVERY_EXECUTIVE"],
  },
  {
    key: "bill_and_collect",
    label: "Bill & Collect",
    activityKeys: ["invoice", "payment"],
    roleHints: ["ACCOUNTANT"],
  },
] as const;

const ACTIVITY_TO_WORK_ITEM = new Map<string, string>();
for (const wi of SO_STANDARD_WORK_ITEMS) {
  for (const k of wi.activityKeys) ACTIVITY_TO_WORK_ITEM.set(k, wi.key);
}

export function workItemKeyForActivity(activityKey: string): string | null {
  return ACTIVITY_TO_WORK_ITEM.get(activityKey) ?? null;
}

export function workItemDef(key: string): SoWorkItemDef | undefined {
  return SO_STANDARD_WORK_ITEMS.find((w) => w.key === key);
}

export type ActivityStatusLike = {
  stepKey: string;
  status: string;
  action?: string;
  id?: string;
  title?: string;
  assignedRole?: string | null;
  kind?: string | null;
};

const TERMINAL = new Set(["COMPLETED", "SKIPPED", "CANCELLED"]);
const ACTIVE = new Set(["READY", "CLAIMED", "IN_PROGRESS"]);

export function deriveWorkItemStatus(
  def: SoWorkItemDef,
  activities: ActivityStatusLike[]
): WorkItemStatus {
  const mine = def.activityKeys
    .map((k) => activities.find((a) => a.stepKey === k))
    .filter(Boolean) as ActivityStatusLike[];

  if (mine.length === 0) return "HIDDEN";

  if (def.conditional) {
    const allSkippedOrMissing = mine.every(
      (a) => a.status === "SKIPPED" || a.status === "CANCELLED"
    );
    if (allSkippedOrMissing) return "HIDDEN";
    // Not yet created / still waiting and never READY → hide until READY or in progress
    const anyVisible = mine.some(
      (a) => ACTIVE.has(a.status) || a.status === "COMPLETED" || a.status === "WAITING"
    );
    // Show WAITING procurement only when it exists as WAITING/READY (shortage path)
    if (!anyVisible) return "HIDDEN";
    if (mine.every((a) => a.status === "WAITING") && !mine.some((a) => ACTIVE.has(a.status))) {
      // Conditional waiting behind inventory: hide until READY
      return "HIDDEN";
    }
  }

  if (mine.every((a) => TERMINAL.has(a.status))) return "COMPLETED";

  const active = mine.filter((a) => ACTIVE.has(a.status));
  if (active.some((a) => a.status === "IN_PROGRESS")) return "IN_PROGRESS";
  if (active.some((a) => a.status === "CLAIMED")) return "CLAIMED";
  if (active.some((a) => a.status === "READY")) return "READY";

  return "WAITING";
}

/** First non-terminal activity in Work Item order (form / complete target). */
export function primaryActivity(
  def: SoWorkItemDef,
  activities: ActivityStatusLike[]
): ActivityStatusLike | null {
  for (const key of def.activityKeys) {
    const a = activities.find((x) => x.stepKey === key);
    if (!a) continue;
    if (ACTIVE.has(a.status)) return a;
  }
  for (const key of def.activityKeys) {
    const a = activities.find((x) => x.stepKey === key);
    if (!a) continue;
    if (a.status === "WAITING") return a;
  }
  return null;
}

export function roleMatchesWorkItem(def: SoWorkItemDef, role: string): boolean {
  const r = role.toUpperCase();
  return def.roleHints.some((h) => {
    const H = h.toUpperCase();
    if (H === r) return true;
    if (
      (H === "SALES_EXECUTIVE" || H === "SALES_REP") &&
      (r === "SALES_EXECUTIVE" || r === "SALES_REP")
    ) {
      return true;
    }
    return false;
  });
}

export type AggregatedWorkItem = {
  key: string;
  label: string;
  status: WorkItemStatus;
  actionable: boolean;
  conditional: boolean;
  activityKeys: string[];
  primaryStepKey: string | null;
  primaryAction: string | null;
  primaryTaskId: string | null;
  activities: ActivityStatusLike[];
};

export function aggregateWorkItems(
  activities: ActivityStatusLike[]
): AggregatedWorkItem[] {
  const human = activities.filter((a) => a.kind !== "SYSTEM");
  const out: AggregatedWorkItem[] = [];
  for (const def of SO_STANDARD_WORK_ITEMS) {
    const status = deriveWorkItemStatus(def, human);
    if (status === "HIDDEN") continue;
    const primary = primaryActivity(def, human);
    const mine = def.activityKeys
      .map((k) => human.find((a) => a.stepKey === k))
      .filter(Boolean) as ActivityStatusLike[];
    out.push({
      key: def.key,
      label: def.label,
      status,
      actionable: ACTIVE.has(status),
      conditional: Boolean(def.conditional),
      activityKeys: [...def.activityKeys],
      primaryStepKey: primary?.stepKey ?? null,
      primaryAction: primary?.action ?? null,
      primaryTaskId: primary?.id ?? null,
      activities: mine,
    });
  }
  return out;
}
