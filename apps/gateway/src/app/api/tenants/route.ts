import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";

// GET /api/tenants — list user's tenants
export async function GET(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const tenants = await prisma.tenantUser.findMany({
    where: { userId: auth.userId, isActive: true },
    include: {
      tenant: { include: { licenses: { where: { isActive: true } } } },
    },
  });

  return NextResponse.json({
    tenants: tenants.map((tu) => ({
      id: tu.tenant.id,
      name: tu.tenant.name,
      slug: tu.tenant.slug,
      plan: tu.tenant.plan,
      role: tu.role,
      modules: tu.tenant.licenses.map((l) => l.moduleId),
    })),
  });
}

// POST /api/tenants — disabled; use Platform Admin POST /api/platform/tenants
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Self-serve tenant creation is disabled. Provision tenants via Platform Admin (POST /api/platform/tenants).",
    },
    { status: 403 }
  );
}
