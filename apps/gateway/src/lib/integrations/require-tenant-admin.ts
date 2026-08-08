import { NextResponse } from "next/server";
import { extractToken, verifyToken } from "@erp/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = new Set(["ADMIN", "ORG_ADMIN", "SUPER_ADMIN"]);

export async function requireTenantAdmin(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const auth = await verifyToken(token);
  if (!auth) return { error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  if (!auth.tenantId) {
    return { error: NextResponse.json({ error: "Tenant required" }, { status: 400 }) };
  }

  const member = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: auth.tenantId, userId: auth.userId } },
  });
  if (!member || !member.isActive) {
    return { error: NextResponse.json({ error: "Tenant not found" }, { status: 404 }) };
  }
  if (!ADMIN_ROLES.has(member.role)) {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }

  return { auth, member };
}
