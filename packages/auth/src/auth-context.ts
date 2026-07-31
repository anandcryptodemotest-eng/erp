/**
 * Authorization context + process designer gate.
 * Gates consume ctx — they do not re-parse JWTs or invent identities.
 */

import {
  CapabilityKey,
  can,
  licenseAllowsProcessStudio,
  type PlatformRole,
} from "@erp/platform-core";

export const DESIGNER_TENANT_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "ORG_ADMIN",
  "PROCESS_OWNER",
] as const;

export type AuthScope = "platform" | "tenant";

export type AuthorizationContext = {
  scope: AuthScope;
  tenantId: string | null;
  operatorId?: string;
  operatorRole?: PlatformRole;
  userId?: string;
  role?: string;
  permissions: Set<string>;
  capabilities: Set<string>;
  licenses: Set<string>;
};

export function buildPlatformAuthContext(input: {
  operatorId: string;
  operatorRole: PlatformRole;
  tenantId: string | null;
}): AuthorizationContext {
  const permissions = new Set<string>();
  if (can(input.operatorRole, "manageProcess")) permissions.add("manageProcess");
  if (can(input.operatorRole, "manageLicenses")) permissions.add("manageLicenses");
  if (can(input.operatorRole, "provisionTenant")) permissions.add("provisionTenant");
  if (can(input.operatorRole, "readAll")) permissions.add("readAll");

  return {
    scope: "platform",
    tenantId: input.tenantId,
    operatorId: input.operatorId,
    operatorRole: input.operatorRole,
    permissions,
    capabilities: new Set(),
    licenses: new Set(),
  };
}

export function buildTenantAuthContext(input: {
  userId: string;
  tenantId: string;
  role: string;
  modules?: string[];
  capabilities?: string[];
}): AuthorizationContext {
  return {
    scope: "tenant",
    tenantId: input.tenantId,
    userId: input.userId,
    role: input.role,
    permissions: new Set(),
    capabilities: new Set(input.capabilities ?? []),
    licenses: new Set(input.modules ?? []),
  };
}

/**
 * Build ctx from headers injected by service middleware after JWT verify.
 */
export function authContextFromHeaders(headers: Headers): AuthorizationContext | null {
  const scope = headers.get("x-auth-scope");
  const tenantId = headers.get("x-tenant-id");

  if (scope === "platform") {
    const operatorId = headers.get("x-operator-id");
    const operatorRole = headers.get("x-operator-role") as PlatformRole | null;
    if (!operatorId || !operatorRole) return null;
    return buildPlatformAuthContext({
      operatorId,
      operatorRole,
      tenantId: tenantId || null,
    });
  }

  const userId = headers.get("x-user-id");
  const role = headers.get("x-user-role");
  if (!userId || !tenantId || !role) return null;

  const capsRaw = headers.get("x-capabilities") || "";
  const modulesRaw = headers.get("x-modules") || "";
  return buildTenantAuthContext({
    userId,
    tenantId,
    role,
    capabilities: capsRaw ? capsRaw.split(",").filter(Boolean) : [],
    modules: modulesRaw ? modulesRaw.split(",").filter(Boolean) : [],
  });
}

export function requireProcessDesigner(ctx: AuthorizationContext | null): Response | null {
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (ctx.scope === "platform") {
    if (!ctx.permissions.has("manageProcess")) {
      return json403("Platform process management required");
    }
    if (!ctx.tenantId) {
      return json403("Target tenant required");
    }
    return null;
  }

  if (ctx.scope === "tenant") {
    if (!ctx.role || !(DESIGNER_TENANT_ROLES as readonly string[]).includes(ctx.role)) {
      return json403("Process designer role required");
    }
    if (!licenseAllowsProcessStudio(ctx.licenses)) {
      return json403("Process Studio is not licensed for this tenant");
    }
    if (!ctx.capabilities.has(CapabilityKey.ProcessStudio)) {
      return json403("Process Studio capability is not enabled for this tenant");
    }
    return null;
  }

  return json403("Process designer access required");
}

/** @deprecated Prefer requireProcessDesigner(authContextFromHeaders(request.headers)) */
export function requireProcessDesignerFromRequest(request: Request): Response | null {
  return requireProcessDesigner(authContextFromHeaders(request.headers));
}

function json403(error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export { CapabilityKey };
