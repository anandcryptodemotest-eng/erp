import { NextResponse } from "next/server";
import { extractToken, verifyToken } from "@erp/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = new Set(["ADMIN", "ORG_ADMIN", "SUPER_ADMIN"]);

export async function requireTenantUser(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  if (!auth.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 401 });
  return auth;
}

export async function requireTenantAdmin(request: Request) {
  const auth = await requireTenantUser(request);
  if (auth instanceof NextResponse) return auth;
  const member = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: auth.tenantId, userId: auth.userId } },
  });
  if (!member?.isActive || !ADMIN_ROLES.has(member.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return auth;
}
