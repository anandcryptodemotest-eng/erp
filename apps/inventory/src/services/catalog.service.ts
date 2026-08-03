import { prisma } from "@/lib/prisma";
import { normalizeIdentityValue } from "@/lib/config-key";

export type CatalogGroupSummary = {
  groupCode: string;
  groupName: string;
  brandId: string | null;
  brandName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  productCount: number;
  imageUrls: string[];
  startingSellPrice: number | null;
  pricingBasis: string | null;
  baseRate: number | null;
  pricingUom: string | null;
};

export type CatalogAttributeOption = {
  key: string;
  label: string;
  options: string[];
  isIdentity: boolean;
  sortOrder: number;
};

function asAttrs(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function attrMatch(productAttrs: Record<string, unknown>, selected: Record<string, string>): boolean {
  for (const [k, v] of Object.entries(selected)) {
    if (v === undefined || v === "") continue;
    if (normalizeIdentityValue(productAttrs[k]) !== normalizeIdentityValue(v)) return false;
  }
  return true;
}

/** List commercial groups (products that share groupCode). Standalone SKUs omitted from groups list. */
export async function listCatalogGroups(
  tenantId: string,
  opts: { categoryId?: string; brandId?: string; search?: string; limit?: number } = {}
) {
  const where = {
    tenantId,
    isActive: true,
    groupCode: { not: null },
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.brandId ? { brandId: opts.brandId } : {}),
    ...(opts.search
      ? {
          OR: [
            { groupName: { contains: opts.search, mode: "insensitive" as const } },
            { groupCode: { contains: opts.search, mode: "insensitive" as const } },
            { name: { contains: opts.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const products = await prisma.product.findMany({
    where,
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ groupName: "asc" }, { name: "asc" }],
    take: 2000,
  });

  const byGroup = new Map<string, typeof products>();
  for (const p of products) {
    if (!p.groupCode) continue;
    if (!byGroup.has(p.groupCode)) byGroup.set(p.groupCode, []);
    byGroup.get(p.groupCode)!.push(p);
  }

  const groups: CatalogGroupSummary[] = [];
  for (const [groupCode, rows] of byGroup) {
    const first = rows[0];
    const sells = rows.map((r) => r.sellPrice).filter((x): x is number => x != null && x > 0);
    const images = rows.flatMap((r) => (Array.isArray(r.imageUrls) ? (r.imageUrls as string[]) : [])).slice(0, 4);
    groups.push({
      groupCode,
      groupName: first.groupName || first.name,
      brandId: first.brandId,
      brandName: first.brand?.name ?? null,
      categoryId: first.categoryId,
      categoryName: first.category?.name ?? null,
      productCount: rows.length,
      imageUrls: images,
      startingSellPrice: sells.length ? Math.min(...sells) : null,
      pricingBasis: first.pricingBasis,
      baseRate: first.baseRate,
      pricingUom: first.pricingUom,
    });
  }

  groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
  return groups.slice(0, opts.limit ?? 100);
}

export async function getCatalogGroup(tenantId: string, groupCode: string) {
  const products = await prisma.product.findMany({
    where: { tenantId, isActive: true, groupCode },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      stocks: { select: { quantity: true, reservedQty: true } },
    },
    orderBy: { name: "asc" },
  });
  if (!products.length) return null;

  const first = products[0];
  const identityDefs = await prisma.productAttributeDefinition.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  // Collect options from SKUs in group (union of values present)
  const valueSets = new Map<string, Set<string>>();
  for (const p of products) {
    const attrs = asAttrs(p.customAttributes);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || String(v).trim() === "") continue;
      if (!valueSets.has(k)) valueSets.set(k, new Set());
      valueSets.get(k)!.add(String(v));
    }
  }

  const attributes: CatalogAttributeOption[] = [];
  for (const def of identityDefs) {
    const set = valueSets.get(def.key);
    if (!set?.size) continue;
    // Include isIdentity always; include other defs when they vary across the group
    if (!def.isIdentity && set.size < 2) continue;
    attributes.push({
      key: def.key,
      label: def.label,
      options: [...set].sort(),
      isIdentity: def.isIdentity,
      sortOrder: def.sortOrder,
    });
  }
  // Remaining keys present on SKUs: always include when they vary; include single-value keys
  // that appear on every product (so configure can show fixed Grade/Thickness chips).
  for (const [key, set] of valueSets) {
    if (attributes.some((a) => a.key === key)) continue;
    const onEvery = products.every((p) => {
      const v = asAttrs(p.customAttributes)[key];
      return v !== null && v !== undefined && String(v).trim() !== "";
    });
    if (set.size < 2 && !onEvery) continue;
    attributes.push({
      key,
      label: key,
      options: [...set].sort(),
      isIdentity: false,
      sortOrder: 999,
    });
  }
  attributes.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  // Completeness: identity axes + any axis that still distinguishes SKUs in the group
  const requiredKeys = attributes.filter((a) => a.isIdentity || a.options.length > 1).map((a) => a.key);

  return {
    groupCode,
    groupName: first.groupName || first.name,
    brand: first.brand,
    category: first.category,
    attributes,
    requiredKeys,
    productCount: products.length,
    imageUrls: products.flatMap((p) => (Array.isArray(p.imageUrls) ? (p.imageUrls as string[]) : [])).slice(0, 6),
    pricingBasis: first.pricingBasis,
    baseRate: first.baseRate,
    pricingUom: first.pricingUom,
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      customAttributes: asAttrs(p.customAttributes),
      sellPrice: p.sellPrice,
      pricingBasis: p.pricingBasis,
      baseRate: p.baseRate,
      pricingUom: p.pricingUom,
      imageUrls: Array.isArray(p.imageUrls) ? (p.imageUrls as string[]).filter(Boolean) : [],
      available: p.stocks.reduce((s, st) => s + (st.quantity - st.reservedQty), 0),
    })),
  };
}

/** Resolve customer attribute selection to zero, one, or many SKUs with completeness. */
export async function resolveCatalogSelection(
  tenantId: string,
  groupCode: string,
  attributes: Record<string, string>
) {
  const group = await getCatalogGroup(tenantId, groupCode);
  if (!group) {
    return {
      completeness: { complete: false, missing: ["group"], unique: false, candidates: 0 },
      product: null,
      stock: null,
      missing: ["group"],
    };
  }

  const selected = Object.fromEntries(
    Object.entries(attributes || {}).filter(([, v]) => v != null && String(v).trim() !== "")
  ) as Record<string, string>;

  const missing = group.requiredKeys.filter((k) => !selected[k]);
  const matching = group.products.filter((p) => attrMatch(p.customAttributes, selected));

  const complete = missing.length === 0;
  const unique = complete && matching.length === 1;

  if (!unique) {
    return {
      completeness: {
        complete,
        missing,
        unique: false,
        candidates: matching.length,
      },
      product: null,
      stock: null,
      hint:
        !complete
          ? `Please select ${missing.map((k) => group.attributes.find((a) => a.key === k)?.label || k).join(", ")}`
          : matching.length === 0
            ? "No product matches this combination"
            : "More options needed to identify a unique product",
    };
  }

  const p = matching[0];
  const imageUrls = Array.isArray(p.imageUrls) ? (p.imageUrls as string[]).filter(Boolean) : [];
  return {
    completeness: { complete: true, missing: [], unique: true, candidates: 1 },
    product: {
      id: p.id,
      sku: p.sku,
      name: p.name,
      sellPrice: p.sellPrice,
      pricingBasis: p.pricingBasis,
      baseRate: p.baseRate,
      pricingUom: p.pricingUom,
      customAttributes: p.customAttributes,
      /** Required contract: always string[]; never omit / undefined */
      imageUrls,
    },
    stock: { available: p.available },
    hint: null,
  };
}
