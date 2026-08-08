import type { DashboardConfig, DashboardPlacement, DashboardPortal } from "./types";

/**
 * Role → default widget placements. Roles are advisory (they drive the default
 * layout only); the resolver still enforces tenant license (requiredModule) +
 * JWT capability gates. Nav keys are never used here.
 *
 * Dashboard = attention (KPIs + summaries + recent). Order Desk is sidebar-only.
 */
const ADMIN_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "admin" } },
  { type: "recent-activity", x: 0, y: 2, w: 12, h: 3 },
  { type: "sreq-order-table", x: 0, y: 5, w: 8, h: 4 },
  { type: "order-status", x: 8, y: 5, w: 4, h: 4 },
  { type: "revenue-trend", x: 0, y: 9, w: 8, h: 4 },
  { type: "top-products", x: 8, y: 9, w: 4, h: 4 },
];

const SALES_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "sales" } },
  { type: "my-tasks-list", x: 0, y: 2, w: 6, h: 4 },
  { type: "sreq-order-table", x: 6, y: 2, w: 6, h: 4 },
  { type: "recent-customers", x: 0, y: 6, w: 12, h: 3 },
];

const PRICING_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "pricing" } },
  { type: "price-ops", x: 0, y: 2, w: 8, h: 5 },
  { type: "top-products", x: 8, y: 2, w: 4, h: 5 },
];

const DISPATCH_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "dispatch" } },
  { type: "delivery-performance", x: 0, y: 2, w: 8, h: 3 },
  { type: "order-status", x: 8, y: 2, w: 4, h: 3 },
  { type: "recent-activity", x: 0, y: 5, w: 12, h: 3 },
];

const DELIVERY_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "delivery" } },
  { type: "delivery-performance", x: 0, y: 2, w: 12, h: 3 },
  { type: "recent-activity", x: 0, y: 5, w: 12, h: 3 },
];

const ACCOUNTANT_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "accountant" } },
  { type: "outstanding-invoices", x: 0, y: 2, w: 6, h: 4 },
  { type: "order-status", x: 6, y: 2, w: 6, h: 4 },
  { type: "recent-activity", x: 0, y: 6, w: 12, h: 3 },
];

const CATALOG_LAYOUT: DashboardPlacement[] = [
  { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "catalog" } },
  { type: "recent-products", x: 0, y: 2, w: 6, h: 4 },
  { type: "top-products", x: 6, y: 2, w: 6, h: 4 },
];

const ROLE_DEFINITIONS: Record<string, DashboardPlacement[]> = {
  ADMIN: ADMIN_LAYOUT,
  SUPER_ADMIN: ADMIN_LAYOUT,
  ORG_ADMIN: ADMIN_LAYOUT,
  MANAGER: ADMIN_LAYOUT,
  BRANCH_ADMIN: ADMIN_LAYOUT,
  PROCESS_OWNER: [
    { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "admin" } },
    { type: "my-tasks-list", x: 0, y: 2, w: 6, h: 4 },
    { type: "recent-activity", x: 6, y: 2, w: 6, h: 4 },
  ],
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
  PROCUREMENT_OFFICER: [
    { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "catalog" } },
    { type: "low-stock", x: 0, y: 2, w: 6, h: 4 },
    { type: "recent-movements", x: 6, y: 2, w: 6, h: 4 },
  ],
  HR_MANAGER: [{ type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "admin" } }],
  VIEWER: [
    { type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "admin" } },
    { type: "order-status", x: 0, y: 2, w: 12, h: 4 },
  ],
  CUSTOMER: [
    { type: "my-orders", x: 0, y: 0, w: 12, h: 4 },
    { type: "monthly-spending", x: 0, y: 4, w: 8, h: 4 },
    { type: "order-status", x: 8, y: 4, w: 4, h: 4 },
  ],
  USER: [{ type: "ops-kpi-row", x: 0, y: 0, w: 12, h: 2, config: { variant: "admin" } }],
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
