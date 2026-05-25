import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, extractToken } from "@erp/auth";

const MODULE_ID = "procurement";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/health") return NextResponse.next();

  const serviceKey = request.headers.get("x-service-key");
  if (serviceKey === (process.env.SERVICE_SECRET || "dev-service-secret")) {
    return NextResponse.next();
  }

  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  if (!auth.modules.includes(MODULE_ID)) {
    return NextResponse.json({ error: `No license for ${MODULE_ID} module` }, { status: 403 });
  }

  const headers = new Headers(request.headers);
  headers.set("x-user-id", auth.userId);
  headers.set("x-tenant-id", auth.tenantId);
  headers.set("x-user-role", auth.role);

  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/api/:path*"] };
