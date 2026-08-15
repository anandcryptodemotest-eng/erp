import type { DashboardConfig, DashboardPlacement, DashboardPortal } from "./types";

/**
 * Role → curated default placements (BL-041).
 *
 * Layers (do not mix):
 * 1. Saved layout — user Customize (x/y/w/h) — NEVER auto-replaced
 * 2. These defaults — only when no preference exists (or after Reset)
 * 3. Phone presentation — getPresentationWidgets (render-only)
 *
 * Principle: Defaults evolve; customizations persist. Charts explain; clicks operationalize.
 * Every default widget must help decide or act — sparse charts only.
 */

const ADMIN_LAYOUT: DashboardPlacement[] = [
  { type: "today-attention", x: 0, y: 0, w: 12, h: 2 },
  { type: "ops-kpi-row", x: 0, y: 2, w: 12, h: 3, config: { variant: "admin" } },
  { type: "my-tasks-list", x: 0, y: 5, w: 6, h: 4 },
  { type: "recent-activity", x: 6, y: 5, w: 6, h: 4 },
  { type: "sreq-order-table", x: 0, y: 9, w: 8, h: 4 },
  { type: "order-status", x: 8, y: 9, w: 4, h: 4 },
  { type: "revenue-trend", x: 0, y: 13, w: 12, h: 4 },
];

/** BL-044: work → pipeline → analysis → relationship (trend | customers). */
const SALES_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "sales" } },
  { type: "my-tasks-list", x: 0, y: 2, w: 6, h: 4 },
  { type: "sreq-order-table", x: 6, y: 2, w: 6, h: 4 },
  { type: "revenue-trend", x: 0, y: 6, w: 8, h: 4 },
  { type: "recent-customers", x: 8, y: 6, w: 4, h: 4 },
];

const PRICING_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "pricing" } },
  { type: "my-tasks-list", x: 0, y: 2, w: 4, h: 5 },
  { type: "price-ops", x: 4, y: 2, w: 5, h: 5 },
  { type: "top-products", x: 9, y: 2, w: 3, h: 5 },
];

const DISPATCH_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "dispatch" } },
  { type: "my-tasks-list", x: 0, y: 2, w: 4, h: 4 },
  { type: "delivery-performance", x: 4, y: 2, w: 5, h: 4 },
  { type: "order-status", x: 9, y: 2, w: 3, h: 4 },
  { type: "recent-activity", x: 0, y: 6, w: 12, h: 3 },
];

const DELIVERY_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "delivery" } },
  { type: "my-tasks-list", x: 0, y: 2, w: 4, h: 4 },
  { type: "delivery-performance", x: 4, y: 2, w: 8, h: 4 },
  { type: "recent-activity", x: 0, y: 6, w: 12, h: 3 },
];

const ACCOUNTANT_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "accountant" } },
  { type: "my-tasks-list", x: 0, y: 2, w: 4, h: 4 },
  { type: "outstanding-invoices", x: 4, y: 2, w: 4, h: 4 },
  { type: "order-status", x: 8, y: 2, w: 4, h: 4 },
  { type: "recent-activity", x: 0, y: 6, w: 12, h: 3 },
];

const CATALOG_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "catalog" } },
  { type: "recent-products", x: 0, y: 2, w: 6, h: 4 },
  { type: "top-products", x: 6, y: 2, w: 6, h: 4 },
  { type: "low-stock", x: 0, y: 6, w: 6, h: 4 },
  { type: "recent-movements", x: 6, y: 6, w: 6, h: 4 },
];

const PROCUREMENT_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "catalog" } },
  { type: "low-stock", x: 0, y: 2, w: 6, h: 4 },
  { type: "recent-movements", x: 6, y: 2, w: 6, h: 4 },
  { type: "recent-products", x: 0, y: 6, w: 6, h: 3 },
  { type: "top-products", x: 6, y: 6, w: 6, h: 3 },
];

const PROCESS_OWNER_LAYOUT: DashboardPlacement[] = [
  { type: "today-attention", x: 0, y: 0, w: 12, h: 2 },
  { type: "ops-kpi-row", x: 0, y: 2, w: 12, h: 2, config: { variant: "admin" } },
  { type: "my-tasks-list", x: 0, y: 4, w: 6, h: 4 },
  { type: "recent-activity", x: 6, y: 4, w: 6, h: 4 },
  { type: "sreq-order-table", x: 0, y: 8, w: 12, h: 4 },
];

const VIEWER_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "admin" } },
  { type: "order-status", x: 0, y: 2, w: 4, h: 4 },
  { type: "revenue-trend", x: 4, y: 2, w: 8, h: 4 },
  { type: "recent-activity", x: 0, y: 6, w: 12, h: 3 },
];

const HR_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "admin" } },
  { type: "recent-activity", x: 0, y: 2, w: 12, h: 4 },
];

const USER_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "admin" } },
  { type: "my-tasks-list", x: 0, y: 2, w: 6, h: 4 },
  { type: "recent-activity", x: 6, y: 2, w: 6, h: 4 },
];

const CUSTOMER_LAYOUT: DashboardPlacement[] = [
  { type: "my-orders", x: 0, y: 0, w: 12, h: 4 },
  { type: "monthly-spending", x: 0, y: 4, w: 8, h: 4 },
  { type: "order-status", x: 8, y: 4, w: 4, h: 4 },
];

const ROLE_DEFINITIONS: Record<string, DashboardPlacement[]> = {
  ADMIN: ADMIN_LAYOUT,
  SUPER_ADMIN: ADMIN_LAYOUT,
  ORG_ADMIN: ADMIN_LAYOUT,
  MANAGER: ADMIN_LAYOUT,
  BRANCH_ADMIN: ADMIN_LAYOUT,
  PROCESS_OWNER: PROCESS_OWNER_LAYOUT,
  CATALOG_MANAGER: CATALOG_LAYOUT,
  ACCOUNTANT: ACCOUNTANT_LAYOUT,
  SALES: SALES_LAYOUT,
  SALES_REP: SALES_LAYOUT,
  SALES_EXECUTIVE: SALES_LAYOUT,
  PRICING: PRICING_LAYOUT,
  PRICING_EXECUTIVE: PRICING_LAYOUT,
  DISPATCH: DISPATCH_LAYOUT,
  DISPATCH_EXECUTIVE: DISPATCH_LAYOUT,
  DELIVERY: DELIVERY_LAYOUT,
  DELIVERY_EXECUTIVE: DELIVERY_LAYOUT,
  PROCUREMENT_OFFICER: PROCUREMENT_LAYOUT,
  HR_MANAGER: HR_LAYOUT,
  VIEWER: VIEWER_LAYOUT,
  CUSTOMER: CUSTOMER_LAYOUT,
  USER: USER_LAYOUT,
};

function placementsForRole(role: string, portal: DashboardPortal): DashboardPlacement[] {
  if (portal === "CUSTOMER") {
    return ROLE_DEFINITIONS.CUSTOMER;
  }
  return ROLE_DEFINITIONS[role] ?? ROLE_DEFINITIONS.USER;
}

export function roleDefaultConfig(role: string, portal: DashboardPortal): DashboardConfig {
  return {
    dashboard: portal,
    layout: { columns: 12 },
    widgets: placementsForRole(role, portal),
  };
}

/**
 * BL-041: never soft-replace saved customizations.
 * Kept as a no-op for import compatibility; GET uses stored.length only.
 */
export function shouldReplaceStaleRoleLayout(
  _role: string,
  _widgets: Array<{ type: string }>
): boolean {
  return false;
}

/** @deprecated Alias of shouldReplaceStaleRoleLayout (always false). */
export function shouldReplaceStaleAdminLayout(
  role: string,
  widgets: Array<{ type: string }>
): boolean {
  return shouldReplaceStaleRoleLayout(role, widgets);
}
