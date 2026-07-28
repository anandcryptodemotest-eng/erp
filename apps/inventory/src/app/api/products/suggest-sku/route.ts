import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Build a short uppercase code from a display name (e.g. "Marine Plywood" → "MAR"). */
function codeFromName(name: string, len = 3): string {
  const compact = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, len);
  if (compact.length >= 2) return compact.padEnd(len, "X").slice(0, len);
  return "GEN";
}

/**
 * GET /api/products/suggest-sku?categoryId=&brandId=
 *
 * Suggests next unique SKU: {CAT}-{BRAND}-{####}
 * Example: Plywood + Century → PLY-CEN-0001
 */
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const brandId = url.searchParams.get("brandId") || undefined;

  let catCode = "GEN";
  let brandCode = "GEN";

  if (categoryId) {
    const cat = await prisma.productCategory.findFirst({
      where: { id: categoryId, tenantId },
      select: { name: true },
    });
    if (cat) catCode = codeFromName(cat.name);
  }

  if (brandId) {
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, tenantId },
      select: { name: true },
    });
    if (brand) brandCode = codeFromName(brand.name);
  }

  const prefix = `${catCode}-${brandCode}-`;

  const existing = await prisma.product.findMany({
    where: { tenantId, sku: { startsWith: prefix } },
    select: { sku: true },
  });

  let maxSeq = 0;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`);
  for (const row of existing) {
    const m = row.sku.match(re);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }

  const next = maxSeq + 1;
  const sku = `${prefix}${String(next).padStart(4, "0")}`;

  return NextResponse.json({
    data: {
      sku,
      prefix,
      sequence: next,
      categoryCode: catCode,
      brandCode,
    },
  });
}
