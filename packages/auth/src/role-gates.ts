/**
 * Role capability gates for service APIs (Tenant Operating Model).
 * Prefer named permission-set roles over proliferating enums.
 */

export const PROCESS_OWNER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "ORG_ADMIN",
  "MANAGER",
  "BRANCH_ADMIN",
  "PROCESS_OWNER",
] as const;

export const CATALOG_MANAGER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "ORG_ADMIN",
  "MANAGER",
  "BRANCH_ADMIN",
  "CATALOG_MANAGER",
] as const;

export const TENANT_ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "ORG_ADMIN"] as const;

/** Desk roles that may read sellable SKUs (not Dispatch / Accountant / Delivery). */
export const PRODUCT_READ_ROLES = [
  ...CATALOG_MANAGER_ROLES,
  "SALES",
  "SALES_EXECUTIVE",
  "SALES_REP",
  "PRICING",
  "PRICING_EXECUTIVE",
  "PROCUREMENT_OFFICER",
  "VIEWER",
] as const;

export const PRICE_LIST_READ_ROLES = [
  ...CATALOG_MANAGER_ROLES,
  "PRICING",
  "PRICING_EXECUTIVE",
] as const;

export const PRICE_LIST_WRITE_ROLES = [
  ...CATALOG_MANAGER_ROLES,
  "PRICING",
  "PRICING_EXECUTIVE",
] as const;

export function roleAllowed(
  role: string | null | undefined,
  allowed: readonly string[]
): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

function trustedService(request: Request): boolean {
  const key = request.headers.get("x-service-key");
  const expected = process.env.SERVICE_SECRET || "dev-service-secret";
  if (!key || !expected || key !== expected) return false;
  const role = request.headers.get("x-user-role");
  // Portal / anonymous BFF (no staff role) may bypass. User-attributed calls still gate.
  if (role && role !== "CUSTOMER") return false;
  return true;
}

function json403(error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export function requireRoles(
  request: Request,
  allowed: readonly string[],
  message = "Insufficient permissions"
): Response | null {
  if (trustedService(request)) return null;
  const role = request.headers.get("x-user-role");
  if (roleAllowed(role, allowed)) return null;
  return json403(message);
}

/**
 * @deprecated Use requireProcessDesigner(authContextFromHeaders(...)) for designer mutate APIs.
 * Kept for non-designer call sites that still key off role only.
 */
export function requireProcessOwner(request: Request): Response | null {
  const role = request.headers.get("x-user-role");
  if (roleAllowed(role, PROCESS_OWNER_ROLES)) return null;
  return new Response(JSON.stringify({ error: "Process Owner access required" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export function requireCatalogManager(request: Request): Response | null {
  if (trustedService(request)) return null;
  const role = request.headers.get("x-user-role");
  if (roleAllowed(role, CATALOG_MANAGER_ROLES)) return null;
  return json403("Catalog Manager access required");
}

export function requireProductRead(request: Request): Response | null {
  return requireRoles(request, PRODUCT_READ_ROLES, "Product catalog read not allowed for this role");
}

export function requirePriceListRead(request: Request): Response | null {
  return requireRoles(request, PRICE_LIST_READ_ROLES, "Price list access required");
}

export function requirePriceListWrite(request: Request): Response | null {
  return requireRoles(request, PRICE_LIST_WRITE_ROLES, "Price list write not allowed for this role");
}
