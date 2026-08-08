import { SignJWT, jwtVerify } from "jose";
import type { AuthToken, UserRole } from "@erp/types";
import {
  PLATFORM_TOKEN_VERSION,
  type PlatformRole,
  type PlatformTokenClaims,
} from "@erp/platform-core";

const DEV_JWT_SECRET = "dev-secret-change-in-production";
const DEV_SERVICE_SECRET = "dev-service-secret";
const SECRET_PLACEHOLDERS = new Set([
  DEV_JWT_SECRET,
  DEV_SERVICE_SECRET,
  "change-me-in-production",
]);

function isStrictSecurityEnvironment() {
  const deployment = (process.env.DEPLOYMENT_ENVIRONMENT ?? "").trim().toLowerCase();
  // Compose/dev images always set NODE_ENV=production for Next standalone.
  // Honor an explicit deployment label so local stacks can keep placeholder secrets.
  if (deployment === "development" || deployment === "dev" || deployment === "local") {
    return false;
  }
  return (
    deployment === "production" ||
    deployment === "staging" ||
    process.env.NODE_ENV === "production"
  );
}

function configuredSecret(name: "JWT_SECRET" | "SERVICE_SECRET", fallback: string) {
  const value = process.env[name]?.trim();
  if (value && (!SECRET_PLACEHOLDERS.has(value) || !isStrictSecurityEnvironment())) {
    return value;
  }
  if (isStrictSecurityEnvironment()) {
    throw new Error(`${name} must be configured with a non-default value`);
  }
  return value || fallback;
}

const getSecret = () =>
  new TextEncoder().encode(configuredSecret("JWT_SECRET", DEV_JWT_SECRET));

export function getServiceSecret() {
  return configuredSecret("SERVICE_SECRET", DEV_SERVICE_SECRET);
}

export function validateAuthSecrets() {
  getSecret();
  getServiceSecret();
}

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
  return { "x-service-key": getServiceSecret() };
}

/**
 * Verify service-to-service call
 */
export function verifyServiceCall(serviceKey: string | null): boolean {
  try {
    return serviceKey === getServiceSecret();
  } catch {
    return false;
  }
}

export type { AuthToken, UserRole };
export type { PlatformTokenClaims, PlatformRole };
export { createServiceMiddleware } from "./middleware";
export {
  getIdentityProviderRegistry,
  getIdentityProvider,
} from "./providers";
export type { IdentityProvider, VerifiedIdentity } from "./providers";
export {
  PROCESS_OWNER_ROLES,
  CATALOG_MANAGER_ROLES,
  TENANT_ADMIN_ROLES,
  PRODUCT_READ_ROLES,
  PRICE_LIST_READ_ROLES,
  PRICE_LIST_WRITE_ROLES,
  roleAllowed,
  requireRoles,
  requireProcessOwner,
  requireCatalogManager,
  requireProductRead,
  requirePriceListRead,
  requirePriceListWrite,
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
