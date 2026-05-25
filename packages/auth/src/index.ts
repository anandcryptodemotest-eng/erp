import { SignJWT, jwtVerify } from "jose";
import type { AuthToken, UserRole } from "@erp/types";

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-in-production");

/**
 * Create a JWT token for inter-service communication
 */
export async function createToken(payload: {
  userId: string;
  tenantId: string;
  role: UserRole;
  modules: string[];
}): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<AuthToken | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as AuthToken;
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
export { createServiceMiddleware } from "./middleware";
