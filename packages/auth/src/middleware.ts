import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, extractToken } from "./index";
import {
  resolveRequestIds,
  REQUEST_ID_HEADER,
  CORRELATION_ID_HEADER,
} from "@erp/logger/ids";

/**
 * Middleware for individual microservices.
 * Validates JWT (or service key), injects auth + request correlation headers.
 * Edge-safe: uses @erp/logger/ids (no Node ALS / createLogger).
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

    const auth = await verifyToken(token);
    if (!auth) {
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

    const headers = new Headers(request.headers);
    headers.set("x-user-id", auth.userId);
    headers.set("x-tenant-id", auth.tenantId);
    headers.set("x-user-role", auth.role);
    injectIds(headers);

    return withIds(NextResponse.next({ request: { headers } }));
  };
}
