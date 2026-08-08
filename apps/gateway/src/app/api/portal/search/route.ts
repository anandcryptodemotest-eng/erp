import { NextResponse } from "next/server";
import { portalInventory, resolvePortalTenantId } from "@/lib/portal-upstream";

/**
 * GET /api/portal/search?q= — first-class catalog search (Customer BFF).
 */
export async function GET(request: Request) {
  const tenantId = await resolvePortalTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || url.searchParams.get("search") || "").trim();
  const limit = url.searchParams.get("limit") || "20";
  if (!q) {
    return NextResponse.json({ data: { groups: [], products: [], suggestions: [] } });
  }

  const qs = new URLSearchParams({ search: q, limit });
  const [groups, products] = await Promise.all([
    portalInventory<{ data?: Array<{ groupCode: string; groupName: string; productCount?: number }> }>(
      tenantId,
      `/api/catalog/groups?${qs}`
    ),
    portalInventory<{ data?: Array<{ id: string; name: string; sku?: string; sellPrice?: number }> }>(
      tenantId,
      `/api/products?${qs}`
    ),
  ]);

  const groupRows = groups.status < 400 ? groups.json.data ?? [] : [];
  const productRows = products.status < 400 ? products.json.data ?? [] : [];
  const suggestions = [
    ...groupRows.slice(0, 5).map((g) => ({
      type: "group" as const,
      id: g.groupCode,
      label: g.groupName,
      href: `/shop/g/${encodeURIComponent(g.groupCode)}`,
    })),
    ...productRows.slice(0, 5).map((p) => ({
      type: "product" as const,
      id: p.id,
      label: p.name,
      href: `/shop/p/${encodeURIComponent(p.id)}`,
    })),
  ];

  return NextResponse.json({
    data: { groups: groupRows, products: productRows, suggestions },
  });
}
