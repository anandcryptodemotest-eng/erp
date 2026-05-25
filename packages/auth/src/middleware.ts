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

    // Check service-to-service calls
    const serviceKey = request.headers.get("x-service-key");
    if (serviceKey === process.env.SERVICE_SECRET) {
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

    // Inject auth context into headers for route handlers
    const response = NextResponse.next();
    response.headers.set("x-user-id", auth.userId);
    response.headers.set("x-tenant-id", auth.tenantId);
    response.headers.set("x-user-role", auth.role);
    return response;
  };
}
