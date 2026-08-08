import { NextResponse } from "next/server";
import { portalInventory, resolvePortalTenantId } from "@/lib/portal-upstream";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const tenantId = await resolvePortalTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  }
  const { id } = await params;
  const { status, json } = await portalInventory(
    tenantId,
    `/api/products/${encodeURIComponent(id)}`
  );
  return NextResponse.json(json, { status });
}
