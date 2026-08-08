import { NextResponse } from "next/server";
import { portalInventory, resolvePortalTenantId } from "@/lib/portal-upstream";

export async function POST(request: Request) {
  const tenantId = await resolvePortalTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  }
  const body = await request.text();
  const { status, json } = await portalInventory(tenantId, "/api/pricing/quote", {
    method: "POST",
    body,
  });
  return NextResponse.json(json, { status });
}
