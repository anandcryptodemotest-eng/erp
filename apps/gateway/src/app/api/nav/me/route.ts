import { NextResponse } from "next/server";
import { extractToken, verifyToken } from "@erp/auth";
import { defaultHomePath, resolveNavModules } from "@/lib/nav-access";

/**
 * GET /api/nav/me — effective sidebar modules + landing path for the JWT role.
 * Navigation ≠ security; use this for dashboard-first landing assertions.
 */
export async function GET(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const modules = [
    ...resolveNavModules(auth.role, undefined, auth.capabilities ?? []),
  ].sort();
  const homePath = defaultHomePath(new Set(modules));

  return NextResponse.json({
    data: {
      role: auth.role,
      homePath,
      modules,
    },
  });
}
