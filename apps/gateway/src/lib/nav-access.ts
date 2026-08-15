/**
 * Admin sidebar access — configured by role (not scattered if-checks).
 *
 * Navigation ≠ security. These keys only control sidebar visibility and
 * client route gating. JWT / role / service authorization remains independent.
 *
 * Nav keys (user navigation) ≠ tenant license modules (sales / inventory / accounting).
 *
 * Canonical workbench key: `order_desk`. `oms` is a legacy path/override alias only.
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
  | "analytics"
  | "customers"
  | "sales_flow"
  | "leads"
  | "opportunities"
  | "quotes"
  | "orders"
  | "products"
  | "categories"
  | "brands"
  | "attributes"
  | "price_lists"
  | "order_desk"
  | "workflows"
  | "configuration"
  | "administration"
  | "users"
  | "vendors"
  | "purchase_orders"
  | "employees"
  | "payroll"
  | "invoices"
  | "returns"
  | "communication";

export const ALL_NAV_MODULES: NavModuleKey[] = [
  "dashboard",
  "analytics",
  "customers",
  "sales_flow",
  "leads",
  "opportunities",
  "quotes",
  "orders",
  "products",
  "categories",
  "brands",
  "attributes",
  "price_lists",
  "order_desk",
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
  "communication",
];

const NAV_KEY_SET = new Set<string>(ALL_NAV_MODULES);

/** Map stored/legacy keys onto the canonical nav vocabulary. `oms` is never an independent permission. */
export function normalizeNavKey(key: string): NavModuleKey | null {
  if (key === "oms") return "order_desk";
  if (NAV_KEY_SET.has(key)) return key as NavModuleKey;
  return null;
}

/**
 * Default face for trading tenants — no CRM pipeline.
 * Re-enable CRM by adding sales_flow / leads / opportunities / quotes, or use "*".
 */
export const TRADING_JOURNEY_NAV: NavModuleKey[] = [
  "dashboard",
  "analytics",
  "customers",
  "products",
  "categories",
  "brands",
  "attributes",
  "price_lists",
  "order_desk",
  "orders",
  "vendors",
  "purchase_orders",
  "invoices",
  "communication",
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
  "order_desk",
  "workflows",
  "configuration",
];

/** Catalog Manager — master data, no Order Desk. */
export const CATALOG_MANAGER_NAV: NavModuleKey[] = [
  "dashboard",
  "products",
  "categories",
  "brands",
  "attributes",
  "price_lists",
  "communication",
];

const SALES_NAV: NavModuleKey[] = [
  "dashboard",
  "products",
  "customers",
  "order_desk",
  "communication",
];

const PRICING_NAV: NavModuleKey[] = [
  "dashboard",
  "products",
  "price_lists",
  "order_desk",
  "communication",
];

const DESK_ONLY_NAV: NavModuleKey[] = ["dashboard", "order_desk", "communication"];

/** Role → allowed module keys. */
export const DEFAULT_ROLE_NAV: Record<string, NavModuleKey[] | "*"> = {
  SUPER_ADMIN: "*",

  ADMIN: [...TRADING_JOURNEY_NAV, "administration", "users"],
  ORG_ADMIN: [...TRADING_JOURNEY_NAV, "administration", "users"],
  MANAGER: TRADING_JOURNEY_NAV,
  BRANCH_ADMIN: TRADING_JOURNEY_NAV,

  PROCESS_OWNER: PROCESS_OWNER_NAV,
  CATALOG_MANAGER: CATALOG_MANAGER_NAV,

  SALES: SALES_NAV,
  SALES_EXECUTIVE: SALES_NAV,
  SALES_REP: SALES_NAV,

  PRICING: PRICING_NAV,
  PRICING_EXECUTIVE: PRICING_NAV,

  DISPATCH: DESK_ONLY_NAV,
  DISPATCH_EXECUTIVE: DESK_ONLY_NAV,
  DELIVERY: DESK_ONLY_NAV,
  DELIVERY_EXECUTIVE: DESK_ONLY_NAV,

  PROCUREMENT_OFFICER: [
    "dashboard",
    "products",
    "vendors",
    "purchase_orders",
    "order_desk",
    "orders",
    "communication",
  ],

  ACCOUNTANT: ["dashboard", "customers", "invoices", "order_desk", "communication"],
  HR_MANAGER: ["dashboard", "employees", "payroll", "communication"],

  VIEWER: ["dashboard", "customers", "products", "order_desk", "orders", "communication"],
  USER: ["dashboard"],

  CUSTOMER: [],
};

export function modulesForRole(role: string | null | undefined): Set<NavModuleKey> {
  if (!role) return new Set(["dashboard"]);
  const cfg = DEFAULT_ROLE_NAV[role] ?? (["dashboard", "order_desk"] as NavModuleKey[]);
  if (cfg === "*") return new Set(ALL_NAV_MODULES);
  const modules = new Set(cfg);
  if (role !== "CUSTOMER") modules.add("communication");
  return modules;
}

/**
 * Resolve effective modules: optional per-user override wins over role defaults.
 * Override is a list of module keys (or ["*"]). Legacy `oms` is mapped to `order_desk`.
 */
export function resolveNavModules(
  role: string | null | undefined,
  userOverride?: string[] | null,
  capabilities?: string[] | null,
  planFeatures?: string[] | null
): Set<NavModuleKey> {
  let allowed: Set<NavModuleKey>;
  if (userOverride?.includes("*")) {
    allowed = new Set(ALL_NAV_MODULES);
  } else if (userOverride && userOverride.length > 0) {
    allowed = new Set<NavModuleKey>();
    for (const raw of userOverride) {
      const key = normalizeNavKey(raw);
      if (key) allowed.add(key);
    }
    if (allowed.size === 0) allowed = modulesForRole(role);
  } else {
    allowed = modulesForRole(role);
  }
  const withStudio = applyProcessStudioCapability(allowed, role, capabilities);
  return intersectPlanFeatures(withStudio, planFeatures);
}

/** Map SaaS feature codes onto sidebar keys. Unknown / omitted features hide nothing (legacy tests). */
export const FEATURE_NAV_MAP: Record<string, NavModuleKey[]> = {
  dashboard: ["dashboard"],
  organization: ["administration"],
  users: ["users"],
  oms: ["order_desk", "orders", "customers", "communication"],
  communication: ["communication"],
  messaging: ["communication"],
  inventory: ["products", "categories", "brands", "attributes", "price_lists"],
  accounting: ["invoices", "returns"],
  ar: ["invoices"],
  gst: ["invoices"],
  procurement: ["vendors", "purchase_orders"],
  process_studio: ["workflows", "configuration"],
  hr: ["employees", "payroll"],
};

/** Always kept when role allows — Gateway platform, not a SaaS SKU gate. */
const PLATFORM_NAV_ALWAYS: ReadonlySet<NavModuleKey> = new Set(["communication"]);

export function intersectPlanFeatures(
  allowed: Set<NavModuleKey>,
  planFeatures?: string[] | null
): Set<NavModuleKey> {
  if (!planFeatures || planFeatures.includes("*")) return allowed;
  const unlocked = new Set<NavModuleKey>();
  for (const code of planFeatures) {
    for (const key of FEATURE_NAV_MAP[code] ?? []) unlocked.add(key);
  }
  const next = new Set<NavModuleKey>();
  for (const key of allowed) {
    if (unlocked.has(key) || PLATFORM_NAV_ALWAYS.has(key)) next.add(key);
  }
  return next;
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
  moduleKey: string | undefined
): boolean {
  if (!moduleKey) return true;
  const key = normalizeNavKey(moduleKey);
  if (!key) return false;
  if (
    (key === "leads" || key === "opportunities" || key === "quotes" || key === "orders") &&
    allowed.has("sales_flow")
  ) {
    return true;
  }
  return allowed.has(key);
}

const HREF_BY_KEY: Partial<Record<NavModuleKey, string>> = {
  dashboard: "/dashboard",
  analytics: "/analytics",
  customers: "/customers",
  sales_flow: "/leads",
  leads: "/leads",
  opportunities: "/opportunities",
  quotes: "/quotes",
  orders: "/orders",
  products: "/products",
  categories: "/categories",
  brands: "/brands",
  attributes: "/attributes",
  price_lists: "/price-lists",
  order_desk: "/sales-desk",
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
  communication: "/messages",
};

/** First landing path after login — dashboard first, never Order Desk by default. */
export function defaultHomePath(allowed: Set<NavModuleKey>): string {
  if (allowed.has("dashboard")) return "/dashboard";
  const first = ALL_NAV_MODULES.find((m) => allowed.has(m));
  return (first && HREF_BY_KEY[first]) || "/dashboard";
}

/**
 * Path → nav module. `/sales-desk` and `/oms` both map to `order_desk`.
 * Catalog screens are split; they are not one `products` bucket.
 */
export function pathToModuleKey(pathname: string): NavModuleKey | null {
  const path = pathname.startsWith("/admin") ? pathname.slice("/admin".length) || "/" : pathname;
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return "dashboard";
  if (path.startsWith("/analytics")) return "analytics";
  if (path.startsWith("/customers")) return "customers";
  if (path.startsWith("/leads")) return "leads";
  if (path.startsWith("/opportunities")) return "opportunities";
  if (path.startsWith("/quotes")) return "quotes";
  if (path.startsWith("/orders")) return "orders";
  if (path.startsWith("/categories")) return "categories";
  if (path.startsWith("/brands")) return "brands";
  if (path.startsWith("/attributes")) return "attributes";
  if (path.startsWith("/price-lists")) return "price_lists";
  if (path.startsWith("/products")) return "products";
  if (path.startsWith("/sales-desk") || path.startsWith("/oms") || path.startsWith("/quick-bill"))
    return "order_desk";
  if (path.startsWith("/workflows")) return "workflows";
  if (path.startsWith("/configuration") || path.startsWith("/forms")) return "configuration";
  if (path.startsWith("/administration") || path.startsWith("/billing")) return "administration";
  if (path.startsWith("/users")) return "users";
  if (path.startsWith("/vendors")) return "vendors";
  if (path.startsWith("/purchase-orders")) return "purchase_orders";
  if (path.startsWith("/employees")) return "employees";
  if (path.startsWith("/payroll")) return "payroll";
  if (path.startsWith("/invoices") || path.startsWith("/gstr1-export") || path.startsWith("/ar"))
    return "invoices";
  if (path.startsWith("/returns")) return "returns";
  if (path.startsWith("/messages") || path.startsWith("/communication")) return "communication";
  return null;
}
