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

export function roleAllowed(
  role: string | null | undefined,
  allowed: readonly string[]
): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

export function requireProcessOwner(request: Request): Response | null {
  const role = request.headers.get("x-user-role");
  if (roleAllowed(role, PROCESS_OWNER_ROLES)) return null;
  return new Response(JSON.stringify({ error: "Process Owner access required" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export function requireCatalogManager(request: Request): Response | null {
  const role = request.headers.get("x-user-role");
  if (roleAllowed(role, CATALOG_MANAGER_ROLES)) return null;
  return new Response(JSON.stringify({ error: "Catalog Manager access required" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
