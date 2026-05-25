import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, extractToken } from "./index";

/**
 * Middleware for individual microservices.
 * Validates JWT token and checks module access.
 */
export function createServiceMiddleware(moduleId: string) {
  return async function middleware(request: NextRequest) {
    // Skip health checks
    if (request.nextUrl.pathname === "/api/health") {
      return NextResponse.next();
    }

    // Check service-to-service calls — fail-closed: reject if env var is unset
    const serviceKey = request.headers.get("x-service-key");
    const serviceSecret = process.env.SERVICE_SECRET;
    if (serviceSecret && serviceKey === serviceSecret) {
      return NextResponse.next();
    }

    // Validate user token
    const token = extractToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = await verifyToken(token);
    if (!auth) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check module access
    if (!auth.modules.includes(moduleId)) {
      return NextResponse.json(
        { error: `No access to ${moduleId} module. Please purchase a license.` },
        { status: 403 }
      );
    }

    // Inject auth context into request headers so route handlers can read them
    const headers = new Headers(request.headers);
    headers.set("x-user-id", auth.userId);
    headers.set("x-tenant-id", auth.tenantId);
    headers.set("x-user-role", auth.role);
    return NextResponse.next({ request: { headers } });
  };
}
