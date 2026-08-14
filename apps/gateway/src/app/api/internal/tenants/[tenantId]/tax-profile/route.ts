import { NextResponse } from "next/server";
import { getServiceSecret } from "@erp/auth";
import { prisma } from "@/lib/prisma";
import { parseTenantTaxProfile } from "@erp/tax-india";

type Ctx = { params: Promise<{ tenantId: string }> };

function isServiceRequest(request: Request): boolean {
  const secret = getServiceSecret();
  const key = request.headers.get("x-service-key");
  return !!secret && key === secret;
}

/** GET /api/internal/tenants/:tenantId/tax-profile — service-to-service tenant tax settings */
export async function GET(request: Request, { params }: Ctx) {
  if (!isServiceRequest(request)) {
    return NextResponse.json({ error: "Service auth required" }, { status: 403 });
  }

  const { tenantId } = await params;
  const headerTenant = request.headers.get("x-tenant-id");
  if (headerTenant && headerTenant !== tenantId) {
    return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
  }

  const rows = await prisma.tenantSetting.findMany({ where: { tenantId } });
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const profile = parseTenantTaxProfile(settings);

  return NextResponse.json({ data: { profile, settings } });
}
