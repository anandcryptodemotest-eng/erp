import { SignJWT, jwtVerify } from "jose";
import type { AuthToken, UserRole } from "@erp/types";
import {
  PLATFORM_TOKEN_VERSION,
  type PlatformRole,
  type PlatformTokenClaims,
} from "@erp/platform-core";

const getSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-in-production");

/**
 * Create a JWT token for inter-service communication
 */
export async function createToken(payload: {
  userId: string;
  tenantId: string;
  role: UserRole;
  modules: string[];
  capabilities?: string[];
}): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    tenantId: payload.tenantId,
    role: payload.role,
    modules: payload.modules,
    capabilities: payload.capabilities ?? [],
    scope: "tenant",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

/**
 * Platform operator JWT — no tenantId / modules.
 */
export async function createPlatformToken(payload: {
  sub: string;
  role: PlatformRole;
  ver?: number;
}): Promise<string> {
  const claims: PlatformTokenClaims = {
    sub: payload.sub,
    scope: "platform",
    role: payload.role,
    ver: payload.ver ?? PLATFORM_TOKEN_VERSION,
  };
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

/**
 * Verify and decode a tenant JWT token
 */
export async function verifyToken(token: string): Promise<AuthToken | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const p = payload as Record<string, unknown>;
    // Platform tokens must use verifyPlatformToken — never treat as tenant
    if (p.scope === "platform") return null;
    if (!p.userId || !p.tenantId || !p.role) return null;
    return p as unknown as AuthToken;
  } catch {
    return null;
  }
}

export async function verifyPlatformToken(token: string): Promise<PlatformTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const p = payload as unknown as PlatformTokenClaims & { sub?: string };
    if (p.scope !== "platform" || !p.role || !p.sub) return null;
    if (typeof p.ver === "number" && p.ver > PLATFORM_TOKEN_VERSION) return null;
    return {
      sub: p.sub,
      scope: "platform",
      role: p.role,
      ver: p.ver ?? PLATFORM_TOKEN_VERSION,
    };
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

/**
 * Service-to-service authentication header
 */
export function serviceAuthHeader(): Record<string, string> {
  const serviceKey = process.env.SERVICE_SECRET || "dev-service-secret";
  return { "x-service-key": serviceKey };
}

/**
 * Verify service-to-service call
 */
export function verifyServiceCall(serviceKey: string | null): boolean {
  const expected = process.env.SERVICE_SECRET || "dev-service-secret";
  return serviceKey === expected;
}

export type { AuthToken, UserRole };
export type { PlatformTokenClaims, PlatformRole };
export { createServiceMiddleware } from "./middleware";
export {
  PROCESS_OWNER_ROLES,
  CATALOG_MANAGER_ROLES,
  TENANT_ADMIN_ROLES,
  roleAllowed,
  requireProcessOwner,
  requireCatalogManager,
} from "./role-gates";
export {
  DESIGNER_TENANT_ROLES,
  buildPlatformAuthContext,
  buildTenantAuthContext,
  authContextFromHeaders,
  requireProcessDesigner,
  requireProcessDesignerFromRequest,
  type AuthorizationContext,
  type AuthScope,
} from "./auth-context";
