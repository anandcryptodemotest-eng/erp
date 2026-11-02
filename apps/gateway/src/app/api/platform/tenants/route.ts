import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProvisionTenantResponse } from "@erp/platform-core";
import { prisma } from "@/lib/prisma";
import { requirePlatformAuth, clientMeta } from "@/lib/platform-auth";
import { provisionTenant, ProvisionTenantError } from "@/lib/provision-tenant";

const createSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .transform((s) => s.trim().toLowerCase())
    .refine((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s), {
      message: "Slug must be lowercase letters, numbers, and hyphens (e.g. acme-corp)",
    }),
  plan: z.string().default("starter"),
  adminEmail: z.string().email(),
  adminName: z.string().optional(),
  adminPassword: z.string().min(8),
  customerDomain: z.string().max(253).optional(),
  adminDomain: z.string().max(253).optional(),
  /** Onboarding recipe — selects modules, order workflow, and warehouse seeding. */
  vertical: z.enum(["grocery", "general", "mobile_retail"]).default("general"),
});

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
    const meta = clientMeta(request);
    const domains = [
      { hostname: body.customerDomain ?? "", portalType: "CUSTOMER" },
      { hostname: body.adminDomain ?? "", portalType: "ADMIN" },
    ].filter((d) => d.hostname);

    const result = await provisionTenant(
      {
        name: body.name,
        slug: body.slug,
        plan: body.plan,
        adminEmail: body.adminEmail,
        adminName: body.adminName,
        adminPassword: body.adminPassword,
        vertical: body.vertical,
        domains,
        auditOperatorId: gate.claims.sub,
        audit: { ip: meta.ip, userAgent: meta.userAgent },
      },
      { requestId: request.headers.get("x-request-id") ?? undefined }
    );

    const payload: ProvisionTenantResponse = {
      tenantId: result.tenant.id,
      slug: result.tenant.slug,
      adminEmail: result.adminEmail,
      loginUrl: result.loginUrl,
    };
    return NextResponse.json({ data: payload }, { status: 201 });
  } catch (error) {
    if (error instanceof ProvisionTenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      const first = error.issues[0];
      const path = first?.path?.join(".") || "input";
      return NextResponse.json(
        { error: `${path}: ${first?.message ?? "Invalid request"}` },
        { status: 400 }
      );
    }
    const msg = error instanceof Error ? error.message : "Internal server error";
    if (/Unique constraint|P2002/i.test(msg)) {
      return NextResponse.json({ error: "Tenant or admin already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
