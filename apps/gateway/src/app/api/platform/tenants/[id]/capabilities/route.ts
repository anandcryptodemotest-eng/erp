import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CapabilityKey,
  CAPABILITY_KEYS,
  licenseAllowsProcessStudio,
} from "@erp/platform-core";
import { prisma } from "@/lib/prisma";
import { requirePlatformAuth, clientMeta } from "@/lib/platform-auth";
import { writePlatformAudit } from "@/lib/platform-audit";

type Ctx = { params: Promise<{ id: string }> };

const putSchema = z.object({
  key: z
    .string()
    .refine((k) => (CAPABILITY_KEYS as string[]).includes(k), "Invalid capability key"),
  enabled: z.boolean(),
});

/** GET /api/platform/tenants/:id/capabilities */
export async function GET(request: Request, { params }: Ctx) {
  const gate = await requirePlatformAuth(request, "readAll");
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      licenses: { where: { isActive: true }, select: { moduleId: true } },
      capabilities: true,
    },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const modules = tenant.licenses.map((l) => l.moduleId);
  const byKey = Object.fromEntries(tenant.capabilities.map((c) => [c.key, c.enabled]));

  return NextResponse.json({
    data: {
      tenantId: id,
      licenseAllowsProcessStudio: licenseAllowsProcessStudio(modules),
      capabilities: CAPABILITY_KEYS.map((key) => ({
        key,
        enabled: byKey[key] === true,
        canEnable:
          key !== CapabilityKey.ProcessStudio || licenseAllowsProcessStudio(modules),
      })),
    },
  });
}

/** PUT /api/platform/tenants/:id/capabilities — set one capability */
export async function PUT(request: Request, { params }: Ctx) {
  const gate = await requirePlatformAuth(request, "manageLicenses");
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;

  const parsed = putSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: { licenses: { where: { isActive: true }, select: { moduleId: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const { key, enabled } = parsed.data;
  if (
    key === CapabilityKey.ProcessStudio &&
    enabled &&
    !licenseAllowsProcessStudio(tenant.licenses.map((l) => l.moduleId))
  ) {
    return NextResponse.json(
      { error: "Process Studio is not licensed for this tenant; enable a core/process license first" },
      { status: 400 }
    );
  }

  const row = await prisma.tenantCapability.upsert({
    where: { tenantId_key: { tenantId: id, key } },
    create: { tenantId: id, key, enabled },
    update: { enabled },
  });

  const meta = clientMeta(request);
  await writePlatformAudit({
    operatorId: gate.claims.sub,
    action: "TENANT_CAPABILITY_UPDATED",
    entityType: "TenantCapability",
    entityId: row.id,
    metadata: { tenantId: id, key, enabled },
    ...meta,
  });

  return NextResponse.json({ data: row });
}
