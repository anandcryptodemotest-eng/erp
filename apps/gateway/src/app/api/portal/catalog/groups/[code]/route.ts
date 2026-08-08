import { NextResponse } from "next/server";
import { portalInventory, resolvePortalTenantId } from "@/lib/portal-upstream";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const tenantId = await resolvePortalTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  }
  const { code } = await params;
  const { status, json } = await portalInventory(
    tenantId,
    `/api/catalog/groups/${encodeURIComponent(code)}`
  );
  return NextResponse.json(json, { status });
}
