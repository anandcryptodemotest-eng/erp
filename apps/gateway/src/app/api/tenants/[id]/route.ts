import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";
import { z } from "zod";

const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  plan: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

// GET /api/tenants/:id — get tenant details (must be a member)
export async function GET(request: Request, { params }: Params) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id } = await params;

  const tenantUser = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: auth.userId } },
    include: {
      tenant: { include: { licenses: { where: { isActive: true } }, settings: true } },
    },
  });

  if (!tenantUser || !tenantUser.isActive) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: tenantUser.tenant.id,
      name: tenantUser.tenant.name,
      slug: tenantUser.tenant.slug,
      plan: tenantUser.tenant.plan,
      isActive: tenantUser.tenant.isActive,
      createdAt: tenantUser.tenant.createdAt,
      role: tenantUser.role,
      modules: tenantUser.tenant.licenses.map((l) => l.moduleId),
      settings: Object.fromEntries(tenantUser.tenant.settings.map((s) => [s.key, s.value])),
    },
  });
}

// PATCH /api/tenants/:id — update tenant (ADMIN only)
export async function PATCH(request: Request, { params }: Params) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id } = await params;

  const tenantUser = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: auth.userId } },
  });

  if (!tenantUser || !tenantUser.isActive) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (tenantUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = updateTenantSchema.parse(body);

    const updated = await prisma.tenant.update({ where: { id }, data });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
