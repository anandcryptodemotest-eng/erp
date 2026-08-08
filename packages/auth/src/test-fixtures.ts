import { NextRequest } from "next/server";
import { createPlatformToken, createToken, getServiceSecret } from "./index";
import type { PlatformRole } from "@erp/platform-core";
import type { UserRole } from "@erp/types";

export function unauthenticatedRequest(path = "/api/test") {
  return new NextRequest(`http://localhost${path}`);
}

export function serviceRequest(path = "/api/test") {
  return new NextRequest(`http://localhost${path}`, {
    headers: { "x-service-key": getServiceSecret() },
  });
}

export async function tenantRequest(input: {
  path?: string;
  userId?: string;
  tenantId?: string;
  role?: UserRole;
  modules?: string[];
  capabilities?: string[];
}) {
  const token = await createToken({
    userId: input.userId ?? "test-user",
    tenantId: input.tenantId ?? "test-tenant",
    role: input.role ?? "ADMIN",
    modules: input.modules ?? [],
    capabilities: input.capabilities ?? [],
  });
  return new NextRequest(`http://localhost${input.path ?? "/api/test"}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

export async function platformRequest(input: {
  path?: string;
  operatorId?: string;
  role?: PlatformRole;
  tenantId?: string;
}) {
  const token = await createPlatformToken({
    sub: input.operatorId ?? "test-operator",
    role: input.role ?? "PLATFORM_ADMIN",
  });
  const headers = new Headers({ authorization: `Bearer ${token}` });
  if (input.tenantId) headers.set("x-tenant-id", input.tenantId);
  return new NextRequest(`http://localhost${input.path ?? "/api/test"}`, { headers });
}
