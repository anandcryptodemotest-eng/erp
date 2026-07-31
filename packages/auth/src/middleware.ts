import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, verifyPlatformToken, extractToken } from "./index";
import {
  resolveRequestIds,
  REQUEST_ID_HEADER,
  CORRELATION_ID_HEADER,
} from "@erp/logger/ids";
import { isPlatformRole } from "@erp/platform-core";

/**
 * Middleware for individual microservices.
 * Validates JWT (platform or tenant) or service key; injects auth + correlation headers.
 * Never synthesizes a tenant identity for platform callers.
 */
export function createServiceMiddleware(moduleId: string) {
  return async function middleware(request: NextRequest) {
    const { requestId, correlationId } = resolveRequestIds(request.headers);

    function withIds(res: NextResponse) {
      res.headers.set(REQUEST_ID_HEADER, requestId);
      res.headers.set(CORRELATION_ID_HEADER, correlationId);
      return res;
    }

    function injectIds(headers: Headers) {
      headers.set(REQUEST_ID_HEADER, requestId);
      headers.set(CORRELATION_ID_HEADER, correlationId);
    }

    const path = request.nextUrl.pathname;
    if (
      path === "/api/health" ||
      path === "/health/live" ||
      path === "/health/ready" ||
      path.endsWith("/health/live") ||
      path.endsWith("/health/ready")
    ) {
      return withIds(NextResponse.next());
    }

    const serviceKey = request.headers.get("x-service-key");
    const serviceSecret = process.env.SERVICE_SECRET;
    if (serviceSecret && serviceKey === serviceSecret) {
      const headers = new Headers(request.headers);
      injectIds(headers);
      return withIds(NextResponse.next({ request: { headers } }));
    }

    const token = extractToken(request.headers.get("authorization"));
    if (!token) {
      return withIds(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }

    // Platform operator — explicit identity; target tenant from client header
    const platform = await verifyPlatformToken(token);
    if (platform && isPlatformRole(platform.role)) {
      const targetTenant = request.headers.get("x-tenant-id");
      const headers = new Headers(request.headers);
      headers.set("x-auth-scope", "platform");
      headers.set("x-operator-id", platform.sub);
      headers.set("x-operator-role", platform.role);
      if (targetTenant) headers.set("x-tenant-id", targetTenant);
      else headers.delete("x-tenant-id");
      headers.delete("x-user-id");
      headers.delete("x-user-role");
      injectIds(headers);
      return withIds(NextResponse.next({ request: { headers } }));
    }

    const auth = await verifyToken(token);
    if (!auth?.userId || !auth.tenantId) {
      return withIds(NextResponse.json({ error: "Invalid token" }, { status: 401 }));
    }

    const modules = Array.isArray(auth.modules) ? auth.modules : [];
    if (modules.length > 0 && !modules.includes(moduleId)) {
      return withIds(
        NextResponse.json(
          { error: `No access to ${moduleId} module. Please purchase a license.` },
          { status: 403 }
        )
      );
    }

    const capabilities = Array.isArray(auth.capabilities) ? auth.capabilities : [];

    const headers = new Headers(request.headers);
    headers.set("x-auth-scope", "tenant");
    headers.set("x-user-id", auth.userId);
    headers.set("x-tenant-id", auth.tenantId);
    headers.set("x-user-role", auth.role);
    headers.set("x-modules", modules.join(","));
    headers.set("x-capabilities", capabilities.join(","));
    injectIds(headers);

    return withIds(NextResponse.next({ request: { headers } }));
  };
}
