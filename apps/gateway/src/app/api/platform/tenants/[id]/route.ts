import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAuth, clientMeta } from "@/lib/platform-auth";
import { writePlatformAudit } from "@/lib/platform-audit";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  plan: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request, { params }: Ctx) {
  const gate = await requirePlatformAuth(request, "readAll");
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      licenses: true,
      settings: true,
      _count: { select: { users: true } },
    },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  return NextResponse.json({
    data: {
      ...tenant,
      users: tenant._count.users,
      lastLogin: null,
      storage: null,
      apiUsage: null,
      loginUrl: `${(process.env.TENANT_ADMIN_PUBLIC_URL || "http://localhost:3010/admin").replace(/\/$/, "")}/login?tenant=${encodeURIComponent(tenant.slug)}`,
    },
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const needsDisable = parsed.data.isActive === false;
  const gate = await requirePlatformAuth(
    request,
    needsDisable ? "disableTenant" : "provisionTenant"
  );
  if (gate instanceof NextResponse) return gate;

  const before = await prisma.tenant.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const tenant = await prisma.$transaction(async (tx) => {
    const updated = await tx.tenant.update({
      where: { id },
      data: parsed.data,
    });

    // Keep login branding in sync when display name changes
    if (parsed.data.name && parsed.data.name !== before.name) {
      await tx.tenantSetting.upsert({
        where: { tenantId_key: { tenantId: id, key: "brand.displayName" } },
        create: { tenantId: id, key: "brand.displayName", value: parsed.data.name },
        update: { value: parsed.data.name },
      });
    }

    return updated;
  });

  const meta = clientMeta(request);
  const action =
    parsed.data.isActive === false
      ? "TENANT_DISABLED"
      : parsed.data.isActive === true
        ? "TENANT_ENABLED"
        : "TENANT_UPDATED";

  await writePlatformAudit({
    operatorId: gate.claims.sub,
    action,
    entityType: "Tenant",
    entityId: id,
    metadata: { before, after: tenant },
    ...meta,
  });

  return NextResponse.json({ data: tenant });
}
