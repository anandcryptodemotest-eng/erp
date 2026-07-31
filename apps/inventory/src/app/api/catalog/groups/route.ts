import { NextResponse } from "next/server";
import { listCatalogGroups } from "@/services/catalog.service";

// GET /api/catalog/groups
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const groups = await listCatalogGroups(tenantId, {
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    brandId: url.searchParams.get("brandId") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    limit: Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50"))),
  });

  return NextResponse.json({ data: groups });
}
