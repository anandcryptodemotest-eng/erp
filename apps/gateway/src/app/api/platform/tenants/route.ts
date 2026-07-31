import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { ProvisionTenantResponse } from "@erp/platform-core";
import { prisma } from "@/lib/prisma";
import { requirePlatformAuth, clientMeta } from "@/lib/platform-auth";
import { writePlatformAudit } from "@/lib/platform-audit";

const createSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  plan: z.string().default("starter"),
  adminEmail: z.string().email(),
  adminName: z.string().optional(),
  adminPassword: z.string().min(8),
});

function tenantLoginUrl(slug: string) {
  const base = (process.env.TENANT_ADMIN_PUBLIC_URL || "http://localhost:3010/admin").replace(/\/$/, "");
  return `${base}/login?tenant=${encodeURIComponent(slug)}`;
}

// GET /api/platform/tenants
export async function GET(request: Request) {
  const gate = await requirePlatformAuth(request, "readAll");
  if (gate instanceof NextResponse) return gate;

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      licenses: { where: { isActive: true }, select: { moduleId: true, plan: true } },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json({
    data: tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      isActive: t.isActive,
      createdAt: t.createdAt,
      users: t._count.users,
      modules: t.licenses.map((l) => l.moduleId),
      lastLogin: null as string | null,
      storage: null as string | null,
      apiUsage: null as string | null,
    })),
  });
}

// POST /api/platform/tenants — transactional provision
export async function POST(request: Request) {
  const gate = await requirePlatformAuth(request, "provisionTenant");
  if (gate instanceof NextResponse) return gate;

  try {
    const body = createSchema.parse(await request.json());
    const existing = await prisma.tenant.findUnique({ where: { slug: body.slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.adminPassword, 12);
    const meta = clientMeta(request);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: body.name,
          slug: body.slug,
          plan: body.plan,
          isActive: true,
        },
      });

      await tx.tenantSetting.createMany({
        data: [
          { tenantId: tenant.id, key: "currency", value: "INR" },
          { tenantId: tenant.id, key: "timezone", value: "Asia/Kolkata" },
          { tenantId: tenant.id, key: "brand.displayName", value: body.name },
        ],
      });

      let user = await tx.user.findUnique({ where: { email: body.adminEmail.toLowerCase() } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email: body.adminEmail.toLowerCase(),
            name: body.adminName ?? body.adminEmail.split("@")[0],
            password: passwordHash,
            role: "USER",
            isActive: true,
          },
        });
      }

      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: "ADMIN",
          isActive: true,
        },
      });

      await tx.moduleLicense.create({
        data: {
          tenantId: tenant.id,
          moduleId: "core",
          plan: "basic",
          isActive: true,
        },
      });

      await tx.platformAuditLog.create({
        data: {
          operatorId: gate.claims.sub,
          action: "TENANT_CREATED",
          entityType: "Tenant",
          entityId: tenant.id,
          metadata: {
            slug: tenant.slug,
            plan: tenant.plan,
            adminEmail: body.adminEmail.toLowerCase(),
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      });

      return { tenant, adminEmail: body.adminEmail.toLowerCase() };
    });

    const payload: ProvisionTenantResponse = {
      tenantId: result.tenant.id,
      slug: result.tenant.slug,
      adminEmail: result.adminEmail,
      loginUrl: tenantLoginUrl(result.tenant.slug),
    };
    return NextResponse.json({ data: payload }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : "Internal server error";
    if (/Unique constraint|P2002/i.test(msg)) {
      return NextResponse.json({ error: "Tenant or admin already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
