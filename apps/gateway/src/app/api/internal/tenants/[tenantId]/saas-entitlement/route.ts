import { NextResponse } from "next/server";
import { getServiceSecret } from "@erp/auth";
import { getTenantEntitlement } from "@/lib/billing-core";

type Ctx = { params: Promise<{ tenantId: string }> };

function isServiceRequest(request: Request): boolean {
  const secret = getServiceSecret();
  const key = request.headers.get("x-service-key");
  return !!secret && key === secret;
}

/** GET /api/internal/tenants/:tenantId/saas-entitlement — live SaaS license check for new OMS. */
export async function GET(request: Request, { params }: Ctx) {
  if (!isServiceRequest(request)) {
    return NextResponse.json({ error: "Service auth required" }, { status: 403 });
  }

  const { tenantId } = await params;
  const headerTenant = request.headers.get("x-tenant-id");
  if (headerTenant && headerTenant !== tenantId) {
    return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
  }

  const entitlement = await getTenantEntitlement(tenantId);
  return NextResponse.json({ data: entitlement });
}
