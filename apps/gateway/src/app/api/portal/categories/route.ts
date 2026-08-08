import { NextResponse } from "next/server";
import { portalInventory, resolvePortalTenantId } from "@/lib/portal-upstream";

export async function GET(request: Request) {
  const tenantId = await resolvePortalTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  }
  const qs = new URL(request.url).searchParams.toString();
  const { status, json } = await portalInventory(
    tenantId,
    `/api/products/categories${qs ? `?${qs}` : ""}`
  );
  return NextResponse.json(json, { status });
}
