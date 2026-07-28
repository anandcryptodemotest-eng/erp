/**
 * Admin sidebar access — configured by role (not scattered if-checks).
 *
 * Trading journey (default): Customer mobile order → SE review → stock/procurement
 * → pricing → dispatch. CRM (Leads / Deals / Quotes / Sales Flow) is hidden until
 * re-enabled via role config or per-user `navModules`.
 *
 * How to change visibility:
 * 1. Edit DEFAULT_ROLE_NAV / TRADING_JOURNEY_NAV below, OR
 * 2. Pass per-user `navModules` at login / store in localStorage (override), OR
 * 3. Later: load from TenantSetting `nav.role.<ROLE>` via API into the same keys.
 *
 * `"*"` = all modules (incl. CRM). Empty array = no admin modules.
 */

export type NavModuleKey =
  | "dashboard"
  | "customers"
  | "sales_flow"
  | "leads"
  | "opportunities"
  | "quotes"
  | "orders"
  | "products"
  | "oms"
  | "vendors"
  | "purchase_orders"
  | "employees"
  | "payroll"
  | "invoices"
  | "returns";

export const ALL_NAV_MODULES: NavModuleKey[] = [
  "dashboard",
  "customers",
  "sales_flow",
  "leads",
  "opportunities",
  "quotes",
  "orders",
  "products",
  "oms",
  "vendors",
  "purchase_orders",
  "employees",
  "payroll",
  "invoices",
  "returns",
];

/**
 * Default face for trading tenants — no CRM pipeline.
 * Re-enable CRM by adding sales_flow / leads / opportunities / quotes, or use "*".
 */
export const TRADING_JOURNEY_NAV: NavModuleKey[] = [
  "dashboard",
  "customers",
  "products",
  "oms",
  "orders",
  "vendors",
  "purchase_orders",
  "invoices",
];

/** CRM modules hidden in the trading journey (still routable if granted explicitly). */
export const CRM_NAV_MODULES: NavModuleKey[] = [
  "sales_flow",
  "leads",
  "opportunities",
  "quotes",
];

/** Role → allowed module keys. */
export const DEFAULT_ROLE_NAV: Record<string, NavModuleKey[] | "*"> = {
  // Platform / break-glass — full ERP including CRM
  SUPER_ADMIN: "*",

  // Org roles — trading journey (CRM off until needed)
  ADMIN: TRADING_JOURNEY_NAV,
  ORG_ADMIN: TRADING_JOURNEY_NAV,
  MANAGER: TRADING_JOURNEY_NAV,
  BRANCH_ADMIN: TRADING_JOURNEY_NAV,

  // Sales desk — mobile orders + OMS
  SALES_EXECUTIVE: ["dashboard", "customers", "products", "oms", "orders"],
  SALES_REP: ["dashboard", "customers", "products", "oms", "orders"],

  // OMS stage owners
  PRICING_EXECUTIVE: ["dashboard", "products", "oms", "orders"],
  DISPATCH_EXECUTIVE: ["dashboard", "oms", "orders"],
  DELIVERY_EXECUTIVE: ["dashboard", "oms"],

  // Procurement + vendor communication
  PROCUREMENT_OFFICER: ["dashboard", "products", "vendors", "purchase_orders", "oms", "orders"],

  // Finance (no CRM)
  ACCOUNTANT: ["dashboard", "customers", "invoices", "orders", "oms"],
  HR_MANAGER: ["dashboard", "employees", "payroll"],

  VIEWER: ["dashboard", "customers", "products", "oms", "orders"],
  USER: ["dashboard"],

  CUSTOMER: [],
};

export function modulesForRole(role: string | null | undefined): Set<NavModuleKey> {
  if (!role) return new Set(["dashboard"]);
  const cfg = DEFAULT_ROLE_NAV[role] ?? DEFAULT_ROLE_NAV.USER ?? ["dashboard"];
  if (cfg === "*") return new Set(ALL_NAV_MODULES);
  return new Set(cfg);
}

/**
 * Resolve effective modules: optional per-user override wins over role defaults.
 * Override is a list of module keys (or ["*"]).
 */
export function resolveNavModules(
  role: string | null | undefined,
  userOverride?: string[] | null
): Set<NavModuleKey> {
  if (userOverride?.includes("*")) return new Set(ALL_NAV_MODULES);
  if (userOverride && userOverride.length > 0) {
    const allowed = new Set<NavModuleKey>();
    for (const key of userOverride) {
      if ((ALL_NAV_MODULES as string[]).includes(key)) {
        allowed.add(key as NavModuleKey);
      }
    }
    return allowed.size > 0 ? allowed : modulesForRole(role);
  }
  return modulesForRole(role);
}

export function canAccessModule(
  allowed: Set<NavModuleKey>,
  moduleKey: NavModuleKey | undefined
): boolean {
  if (!moduleKey) return true;
  if (
    (moduleKey === "leads" ||
      moduleKey === "opportunities" ||
      moduleKey === "quotes" ||
      moduleKey === "orders") &&
    allowed.has("sales_flow")
  ) {
    return true;
  }
  return allowed.has(moduleKey);
}

/** First landing path for a role after login — OMS desk for trading journey. */
export function defaultHomePath(allowed: Set<NavModuleKey>): string {
  if (allowed.has("oms") && !allowed.has("sales_flow")) {
    return "/oms";
  }
  if (allowed.has("dashboard")) return "/dashboard";
  if (allowed.has("oms")) return "/oms";
  const first = ALL_NAV_MODULES.find((m) => allowed.has(m));
  const hrefByKey: Partial<Record<NavModuleKey, string>> = {
    dashboard: "/dashboard",
    customers: "/customers",
    sales_flow: "/leads",
    leads: "/leads",
    opportunities: "/opportunities",
    quotes: "/quotes",
    orders: "/orders",
    products: "/products",
    oms: "/oms",
    vendors: "/vendors",
    purchase_orders: "/purchase-orders",
    employees: "/employees",
    payroll: "/payroll",
    invoices: "/invoices",
    returns: "/returns",
  };
  return (first && hrefByKey[first]) || "/dashboard";
}

export function pathToModuleKey(pathname: string): NavModuleKey | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "dashboard";
  if (pathname.startsWith("/customers")) return "customers";
  if (pathname.startsWith("/leads")) return "leads";
  if (pathname.startsWith("/opportunities")) return "opportunities";
  if (pathname.startsWith("/quotes")) return "quotes";
  if (pathname.startsWith("/orders")) return "orders";
  if (pathname.startsWith("/products") || pathname.startsWith("/attributes")) return "products";
  if (pathname.startsWith("/oms")) return "oms";
  if (pathname.startsWith("/vendors")) return "vendors";
  if (pathname.startsWith("/purchase-orders")) return "purchase_orders";
  if (pathname.startsWith("/employees")) return "employees";
  if (pathname.startsWith("/payroll")) return "payroll";
  if (pathname.startsWith("/invoices")) return "invoices";
  if (pathname.startsWith("/returns")) return "returns";
  return null;
}
