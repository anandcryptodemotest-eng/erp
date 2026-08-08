import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAuth, clientMeta } from "@/lib/platform-auth";
import { writePlatformAudit } from "@/lib/platform-audit";

type Ctx = { params: Promise<{ id: string; domainId: string }> };

const portalTypes = ["CUSTOMER", "ADMIN", "SUPPLIER", "EMPLOYEE", "PUBLIC"] as const;
const patchSchema = z.object({
  hostname: z.string().min(3).max(253).optional(),
  portalType: z.enum(portalTypes).optional(),
  isPrimary: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  certificateStatus: z.enum(["PENDING", "ACTIVE", "FAILED"]).optional(),
});

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function validHostname(value: string) {
  return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const gate = await requirePlatformAuth(request, "provisionTenant");
  if (gate instanceof NextResponse) return gate;
  const { id, domainId } = await params;
  const current = await prisma.tenantDomain.findFirst({ where: { id: domainId, tenantId: id } });
  if (!current) return NextResponse.json({ error: "Domain mapping not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  const data = { ...parsed.data };
  if (data.hostname) {
    data.hostname = normalizeHostname(data.hostname);
    if (!validHostname(data.hostname)) {
      return NextResponse.json({ error: "Enter a valid hostname without protocol or path" }, { status: 400 });
    }
  }
  const portalType = data.portalType ?? current.portalType;

  try {
    const domain = await prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.tenantDomain.updateMany({
          where: { tenantId: id, portalType },
          data: { isPrimary: false },
        });
      }
      return tx.tenantDomain.update({ where: { id: domainId }, data });
    });
    await writePlatformAudit({
      operatorId: gate.claims.sub,
      action: "TENANT_DOMAIN_UPDATED",
      entityType: "TenantDomain",
      entityId: domain.id,
      metadata: { tenantId: id, before: current, after: domain },
      ...clientMeta(request),
    });
    return NextResponse.json({ data: domain });
  } catch (error) {
    if (error instanceof Error && /Unique constraint|P2002/i.test(error.message)) {
      return NextResponse.json({ error: "Hostname is already mapped" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to update domain mapping" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const gate = await requirePlatformAuth(request, "provisionTenant");
  if (gate instanceof NextResponse) return gate;
  const { id, domainId } = await params;
  const current = await prisma.tenantDomain.findFirst({ where: { id: domainId, tenantId: id } });
  if (!current) return NextResponse.json({ error: "Domain mapping not found" }, { status: 404 });

  await prisma.tenantDomain.delete({ where: { id: domainId } });
  await writePlatformAudit({
    operatorId: gate.claims.sub,
    action: "TENANT_DOMAIN_DELETED",
    entityType: "TenantDomain",
    entityId: domainId,
    metadata: { tenantId: id, hostname: current.hostname, portalType: current.portalType },
    ...clientMeta(request),
  });
  return NextResponse.json({ data: { id: domainId } });
}
