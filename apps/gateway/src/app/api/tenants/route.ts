import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";
import { z } from "zod";

const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  plan: z.string().default("starter"),
});

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

// POST /api/tenants — create new tenant
export async function POST(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  try {
    const body = await request.json();
    const { name, slug, plan } = createTenantSchema.parse(body);

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 400 });
    }

    const tenant = await prisma.tenant.create({
      data: { name, slug, plan },
    });

    // Add the creating user as ADMIN
    await prisma.tenantUser.create({
      data: { tenantId: tenant.id, userId: auth.userId, role: "ADMIN" },
    });

    // Grant core module by default
    await prisma.moduleLicense.create({
      data: { tenantId: tenant.id, moduleId: "core", plan: "basic" },
    });

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
