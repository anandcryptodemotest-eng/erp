import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  hostname: z.string().min(1).max(253),
  portalType: z.enum(["CUSTOMER", "ADMIN", "SUPPLIER", "EMPLOYEE", "PUBLIC"]).default("CUSTOMER"),
});

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    hostname: url.searchParams.get("hostname") ?? "",
    portalType: url.searchParams.get("portalType") ?? "CUSTOMER",
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid hostname" }, { status: 400 });

  const hostname = normalizeHostname(parsed.data.hostname);
  const select = {
    hostname: true,
    portalType: true,
    tenant: { select: { id: true, name: true, slug: true } },
  } as const;
  const domain =
    (await prisma.tenantDomain.findFirst({
      where: {
        hostname,
        portalType: parsed.data.portalType,
        isVerified: true,
        tenant: { isActive: true },
      },
      select,
    })) ??
    // Single-IP / shared host: hostname is unique, so ADMIN and CUSTOMER cannot both be stored.
    (await prisma.tenantDomain.findFirst({
      where: { hostname, isVerified: true, tenant: { isActive: true } },
      select,
    }));
  if (!domain) return NextResponse.json({ error: "Tenant domain not found" }, { status: 404 });

  return NextResponse.json({ data: { ...domain.tenant, hostname: domain.hostname, portalType: domain.portalType } });
}
