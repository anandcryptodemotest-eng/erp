import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalInventory, resolvePortalTenantId } from "@/lib/portal-upstream";

/**
 * GET /api/portal/home — Customer BFF aggregate for public home.
 */
export async function GET(request: Request) {
  const tenantId = await resolvePortalTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  }

  const [banners, featured, categories] = await Promise.all([
    prisma.banner
      .findMany({
        where: { tenantId, isActive: true },
        orderBy: { position: "asc" },
        take: 5,
      })
      .catch(() => []),
    portalInventory<{ data?: unknown[] }>(tenantId, "/api/products?isFeatured=true&limit=12"),
    portalInventory<{ data?: unknown[] }>(tenantId, "/api/products/categories?limit=10"),
  ]);

  let products = featured.status < 400 ? featured.json.data ?? [] : [];
  if (products.length === 0) {
    const all = await portalInventory<{ data?: unknown[] }>(
      tenantId,
      "/api/products?isActive=true&limit=12"
    );
    if (all.status < 400) products = all.json.data ?? [];
  }

  return NextResponse.json({
    data: {
      banners,
      featured: products,
      categories: categories.status < 400 ? categories.json.data ?? [] : [],
    },
  });
}
