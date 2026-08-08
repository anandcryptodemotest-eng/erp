import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAuth, clientMeta } from "@/lib/platform-auth";
import { writePlatformAudit } from "@/lib/platform-audit";

type Ctx = { params: Promise<{ id: string }> };

const portalTypes = ["CUSTOMER", "ADMIN", "SUPPLIER", "EMPLOYEE", "PUBLIC"] as const;
const domainSchema = z.object({
  hostname: z.string().min(3).max(253),
  portalType: z.enum(portalTypes).default("CUSTOMER"),
  isPrimary: z.boolean().default(false),
  isVerified: z.boolean().default(false),
  certificateStatus: z.enum(["PENDING", "ACTIVE", "FAILED"]).default("PENDING"),
});

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

async function getTenant(id: string) {
  return prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
}

export async function GET(request: Request, { params }: Ctx) {
  const gate = await requirePlatformAuth(request, "readAll");
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  if (!(await getTenant(id))) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const domains = await prisma.tenantDomain.findMany({
    where: { tenantId: id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ data: domains });
}

export async function POST(request: Request, { params }: Ctx) {
  const gate = await requirePlatformAuth(request, "provisionTenant");
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  if (!(await getTenant(id))) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const parsed = domainSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  const data = { ...parsed.data, hostname: normalizeHostname(parsed.data.hostname) };
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(data.hostname)) {
    return NextResponse.json({ error: "Enter a valid hostname without protocol or path" }, { status: 400 });
  }

  try {
    const domain = await prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.tenantDomain.updateMany({
          where: { tenantId: id, portalType: data.portalType },
          data: { isPrimary: false },
        });
      }
      return tx.tenantDomain.create({ data: { ...data, tenantId: id } });
    });
    await writePlatformAudit({
      operatorId: gate.claims.sub,
      action: "TENANT_DOMAIN_CREATED",
      entityType: "TenantDomain",
      entityId: domain.id,
      metadata: { tenantId: id, hostname: domain.hostname, portalType: domain.portalType },
      ...clientMeta(request),
    });
    return NextResponse.json({ data: domain }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /Unique constraint|P2002/i.test(error.message)) {
      return NextResponse.json({ error: "Hostname is already mapped" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create domain mapping" }, { status: 500 });
  }
}
