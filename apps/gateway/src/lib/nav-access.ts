/**
 * Admin sidebar access — configured by role (not scattered if-checks).
 *
 * Trading journey (default): Customer mobile order → SE review → stock/procurement
 * → pricing → dispatch. CRM (Leads / Deals / Quotes / Sales Flow) is hidden until
 * re-enabled via role config or per-user `navModules`.
 *
 * Governance: see docs/architecture/tenant-operating-model.md
 * Role → Permissions → Navigation → Capabilities
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
  | "workflows"
  | "configuration"
  | "administration"
  | "users"
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
  "workflows",
  "configuration",
  "administration",
  "users",
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

/** Process Owner permission set — business configuration (workflows / forms). */
export const PROCESS_OWNER_NAV: NavModuleKey[] = [
  "dashboard",
  "oms",
  "workflows",
  "configuration",
];

/** Catalog Manager permission set — master data. */
export const CATALOG_MANAGER_NAV: NavModuleKey[] = [
  "dashboard",
  "products",
  "oms",
];

/** Role → allowed module keys. */
export const DEFAULT_ROLE_NAV: Record<string, NavModuleKey[] | "*"> = {
  SUPER_ADMIN: "*",

  ADMIN: [...TRADING_JOURNEY_NAV, "administration", "users"],
  ORG_ADMIN: [...TRADING_JOURNEY_NAV, "administration", "users"],
  MANAGER: TRADING_JOURNEY_NAV,
  BRANCH_ADMIN: TRADING_JOURNEY_NAV,

  /** Named permission sets (Tenant Operating Model) */
  PROCESS_OWNER: PROCESS_OWNER_NAV,
  CATALOG_MANAGER: CATALOG_MANAGER_NAV,

  SALES_EXECUTIVE: ["dashboard", "customers", "products", "oms"],
  SALES_REP: ["dashboard", "customers", "products", "oms"],

  PRICING_EXECUTIVE: ["dashboard", "products", "oms"],
  DISPATCH_EXECUTIVE: ["dashboard", "oms"],
  DELIVERY_EXECUTIVE: ["dashboard", "oms"],

  PROCUREMENT_OFFICER: ["dashboard", "products", "vendors", "purchase_orders", "oms", "orders"],

  ACCOUNTANT: ["dashboard", "customers", "invoices", "oms"],
  HR_MANAGER: ["dashboard", "employees", "payroll"],

  VIEWER: ["dashboard", "customers", "products", "oms", "orders"],
  USER: ["dashboard"],

  CUSTOMER: [],
};

export function modulesForRole(role: string | null | undefined): Set<NavModuleKey> {
  if (!role) return new Set(["dashboard"]);
  const cfg = DEFAULT_ROLE_NAV[role] ?? (["dashboard", "oms"] as NavModuleKey[]);
  if (cfg === "*") return new Set(ALL_NAV_MODULES);
  return new Set(cfg);
}

/**
 * Resolve effective modules: optional per-user override wins over role defaults.
 * Override is a list of module keys (or ["*"]).
 */
export function resolveNavModules(
  role: string | null | undefined,
  userOverride?: string[] | null,
  capabilities?: string[] | null
): Set<NavModuleKey> {
  let allowed: Set<NavModuleKey>;
  if (userOverride?.includes("*")) {
    allowed = new Set(ALL_NAV_MODULES);
  } else if (userOverride && userOverride.length > 0) {
    allowed = new Set<NavModuleKey>();
    for (const key of userOverride) {
      if ((ALL_NAV_MODULES as string[]).includes(key)) {
        allowed.add(key as NavModuleKey);
      }
    }
    if (allowed.size === 0) allowed = modulesForRole(role);
  } else {
    allowed = modulesForRole(role);
  }
  return applyProcessStudioCapability(allowed, role, capabilities);
}

/** Process Studio nav only when TenantCapability processStudio is enabled. */
export function applyProcessStudioCapability(
  allowed: Set<NavModuleKey>,
  role: string | null | undefined,
  capabilities?: string[] | null
): Set<NavModuleKey> {
  const next = new Set(allowed);
  const enabled = capabilities?.includes("processStudio") === true;
  if (!enabled) {
    next.delete("workflows");
    next.delete("configuration");
    return next;
  }
  const designer =
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "ORG_ADMIN" ||
    role === "PROCESS_OWNER" ||
    allowed.size === ALL_NAV_MODULES.length;
  if (designer) {
    next.add("workflows");
    next.add("configuration");
  }
  return next;
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
    workflows: "/workflows",
    configuration: "/configuration",
    administration: "/administration",
    users: "/users",
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
  if (pathname.startsWith("/products") || pathname.startsWith("/attributes") || pathname.startsWith("/categories") || pathname.startsWith("/brands") || pathname.startsWith("/price-lists")) return "products";
  if (pathname.startsWith("/oms")) return "oms";
  if (pathname.startsWith("/workflows")) return "workflows";
  if (pathname.startsWith("/configuration") || pathname.startsWith("/forms")) return "configuration";
  if (pathname.startsWith("/administration")) return "administration";
  if (pathname.startsWith("/users")) return "users";
  if (pathname.startsWith("/vendors")) return "vendors";
  if (pathname.startsWith("/purchase-orders")) return "purchase_orders";
  if (pathname.startsWith("/employees")) return "employees";
  if (pathname.startsWith("/payroll")) return "payroll";
  if (pathname.startsWith("/invoices")) return "invoices";
  if (pathname.startsWith("/returns")) return "returns";
  return null;
}
