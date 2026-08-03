import { prisma } from "@/lib/prisma";
import { buildProductConfigKey } from "@/lib/config-key";
import { cartesian } from "@/lib/cartesian";
import {
  buildGeneratedName,
  expandSkuTemplate,
  fallbackSkuFromAttrs,
  MAX_PRODUCT_NAME_LENGTH,
  MAX_SKU_LENGTH,
} from "@/lib/sku-template";
import {
  findBatchDuplicates,
  validateOutputLengths,
  validatePricingDefaults,
  type GenerationIssue,
  type PreviewRow,
} from "@/lib/validation";
import { resolveAttributeDefinitions, syncAttributeIndex } from "@/lib/attributes";
import { resolveRowImageUrls, type CommercialMedia } from "@/lib/commercial-media";

export type GenerateRequest = {
  categoryId: string;
  brandId?: string | null;
  axes: Record<string, string[]>;
  skuTemplate?: string | null;
  nameTemplate?: string | null;
  pricingBasis?: string;
  pricingUom?: string | null;
  baseRate?: number | null;
  namePrefix?: string | null;
  groupCode?: string | null;
  groupName?: string | null;
  /** Commercial description (same for every SKU in the batch). */
  description?: string | null;
  /** Commercial media — mapped to Product.imageUrls on persist (v1 denormalization). */
  media?: CommercialMedia | null;
  costPrice?: number | null;
  reorderLevel?: number | null;
  /** Per-row commercial sell/base amounts keyed by row index (from CreatePlan). */
  rowCommercialPrices?: Record<number, number | null>;
};

export type GenerateRowStatus = "new" | "duplicate_sku" | "duplicate_identity" | "invalid";

export type GeneratePreviewRow = PreviewRow & {
  status: GenerateRowStatus;
  fingerprint: string | null;
  existingSku?: string;
};

function brandCode(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);
}

function expandNameTemplate(template: string, tokens: Record<string, unknown>): string {
  return template
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
      const raw = tokens[key];
      if (raw === null || raw === undefined) return "";
      return String(raw).trim();
    })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PRODUCT_NAME_LENGTH);
}

function asJsonObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

/** Build preview rows from wizard payload (no ProductDefinition). */
export async function previewProductGeneration(tenantId: string, req: GenerateRequest) {
  const issues: GenerationIssue[] = [];
  const axes = Object.fromEntries(
    Object.entries(req.axes || {}).filter(([, v]) => Array.isArray(v) && v.length > 0)
  ) as Record<string, string[]>;

  if (Object.keys(axes).length === 0) {
    return {
      rows: [] as GeneratePreviewRow[],
      issues: [{ code: "EMPTY_AXES" as const, message: "Select at least one attribute value" }],
      summary: { total: 0, willCreate: 0, duplicates: 0, invalid: 0 },
    };
  }

  const pricingBasis = req.pricingBasis || "PER_EACH";
  const pricingIssue = validatePricingDefaults({
    defaultPricingBasis: pricingBasis,
    defaultPricingUom: req.pricingUom,
    defaultBaseRate: req.baseRate,
  });
  if (pricingIssue) issues.push(pricingIssue);

  const [category, brand, identityDefs] = await Promise.all([
    prisma.productCategory.findFirst({ where: { id: req.categoryId, tenantId } }),
    req.brandId
      ? prisma.brand.findFirst({ where: { id: req.brandId, tenantId } })
      : Promise.resolve(null),
    prisma.productAttributeDefinition.findMany({
      where: { tenantId, isActive: true, isIdentity: true },
      select: { key: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!category) {
    return {
      rows: [] as GeneratePreviewRow[],
      issues: [{ code: "EMPTY_AXES" as const, message: "Category not found" }],
      summary: { total: 0, willCreate: 0, duplicates: 0, invalid: 0 },
    };
  }

  const identityKeys =
    identityDefs.map((d) => d.key).filter((k) => k in axes).length > 0
      ? identityDefs.map((d) => d.key).filter((k) => k in axes)
      : Object.keys(axes);

  const bCode = brandCode(brand?.name);
  const prefix =
    bCode ||
    category.name
      .slice(0, 3)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "") ||
    "SKU";

  const combos = cartesian(axes);
  const rows: GeneratePreviewRow[] = [];

  for (let i = 0; i < combos.length; i++) {
    const attrs = combos[i];
    const tokens: Record<string, unknown> = {
      ...attrs,
      brand: bCode || brand?.name || "",
      category: category.name.slice(0, 3).toUpperCase(),
    };

    let sku: string;
    if (req.skuTemplate) {
      const expanded = expandSkuTemplate(req.skuTemplate, tokens);
      if (expanded.unresolved.length) {
        issues.push({
          code: "BAD_SKU_TEMPLATE",
          message: `Unresolved SKU tokens: ${expanded.unresolved.join(", ")}`,
          index: i,
        });
      }
      sku = expanded.sku;
    } else {
      sku = fallbackSkuFromAttrs(prefix, attrs, identityKeys);
    }

    let name: string;
    if (req.nameTemplate) {
      name = expandNameTemplate(req.nameTemplate, {
        ...attrs,
        brand: brand?.name || "",
        category: category.name,
      });
    } else if (req.namePrefix) {
      name = buildGeneratedName(req.namePrefix, attrs, identityKeys);
    } else {
      name = buildGeneratedName(
        [brand?.name, category.name].filter(Boolean).join(" ") || category.name,
        attrs,
        identityKeys
      );
    }

    const fingerprint = buildProductConfigKey(
      ["brand", ...identityKeys.filter((k) => k !== "brand")],
      { brand: brand?.name || brand?.id || "", ...attrs }
    );

    rows.push({
      index: i,
      sku: sku.slice(0, MAX_SKU_LENGTH),
      name: name.slice(0, MAX_PRODUCT_NAME_LENGTH),
      configKey: fingerprint || `row-${i}`,
      customAttributes: attrs,
      status: "new",
      fingerprint,
    });
  }

  issues.push(...rows.flatMap(validateOutputLengths), ...findBatchDuplicates(rows));

  const skus = rows.map((r) => r.sku);
  const existingBySku = skus.length
    ? await prisma.product.findMany({
        where: { tenantId, sku: { in: skus }, isActive: true },
        select: { id: true, sku: true, brandId: true, customAttributes: true },
      })
    : [];
  const skuMap = new Map(existingBySku.map((p) => [p.sku.toUpperCase(), p]));

  // Load candidates with same brand for fingerprint compare
  const sameBrand = await prisma.product.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(req.brandId ? { brandId: req.brandId } : { brandId: null }),
    },
    select: { id: true, sku: true, customAttributes: true, brandId: true },
    take: 5000,
  });

  const identityFp = (attrs: Record<string, unknown>, brandName: string) =>
    buildProductConfigKey(["brand", ...identityKeys], { brand: brandName, ...attrs });

  const brandName = brand?.name || "";
  const existingFp = new Map<string, string>();
  for (const p of sameBrand) {
    const fp = identityFp(asJsonObject(p.customAttributes), brandName);
    if (fp) existingFp.set(fp, p.sku);
  }

  let willCreate = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const row of rows) {
    const lengthBad = !row.sku || row.sku.length > MAX_SKU_LENGTH || !row.name;
    if (lengthBad) {
      row.status = "invalid";
      invalid++;
      continue;
    }
    if (skuMap.has(row.sku.toUpperCase())) {
      row.status = "duplicate_sku";
      row.existingSku = skuMap.get(row.sku.toUpperCase())!.sku;
      duplicates++;
      continue;
    }
    if (row.fingerprint && existingFp.has(row.fingerprint)) {
      row.status = "duplicate_identity";
      row.existingSku = existingFp.get(row.fingerprint);
      duplicates++;
      continue;
    }
    row.status = "new";
    willCreate++;
  }

  return {
    rows,
    issues,
    summary: {
      total: rows.length,
      willCreate,
      duplicates,
      invalid,
    },
    meta: {
      categoryId: category.id,
      brandId: brand?.id ?? null,
      pricingBasis,
      pricingUom: req.pricingUom ?? null,
      baseRate: req.baseRate ?? null,
    },
  };
}

export async function createProductsFromGeneration(tenantId: string, req: GenerateRequest) {
  const preview = await previewProductGeneration(tenantId, req);
  const blocking = preview.issues.filter((i) =>
    ["EMPTY_AXES", "MISSING_PRICING_DEFAULTS", "BAD_SKU_TEMPLATE"].includes(i.code)
  );
  if (blocking.length && preview.summary.willCreate === 0 && preview.summary.total === 0) {
    return { error: "VALIDATION" as const, issues: blocking, preview };
  }

  const toCreate = preview.rows.filter((r) => r.status === "new");
  const skipped = preview.rows.filter((r) => r.status !== "new");
  return persistGeneratedRows(tenantId, req, toCreate, skipped, preview);
}

/** Persist planned rows without re-analyzing (CreatePlan contract). */
export async function persistGeneratedRows(
  tenantId: string,
  req: GenerateRequest,
  toCreate: GeneratePreviewRow[],
  skipped: GeneratePreviewRow[],
  preview?: Awaited<ReturnType<typeof previewProductGeneration>>
) {
  if (toCreate.length === 0) {
    return {
      created: [],
      skipped,
      summary: {
        total: (toCreate.length + skipped.length) || preview?.summary.total || 0,
        willCreate: 0,
        duplicates: skipped.length,
        invalid: 0,
        createdCount: 0,
        skippedCount: skipped.length,
      },
      preview,
    };
  }

  const pricingBasis = req.pricingBasis || "PER_EACH";
  const definitions = await resolveAttributeDefinitions(tenantId, req.categoryId);

  const created = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const row of toCreate) {
      const rowPrice =
        req.rowCommercialPrices && Object.prototype.hasOwnProperty.call(req.rowCommercialPrices, row.index)
          ? req.rowCommercialPrices[row.index]
          : undefined;
      const commercial = rowPrice !== undefined ? rowPrice : req.baseRate ?? null;
      const rowAttrs = Object.fromEntries(
        Object.entries(asJsonObject(row.customAttributes)).map(([k, v]) => [k, String(v ?? "")])
      );
      const images = resolveRowImageUrls(req.media, rowAttrs);
      const product = await tx.product.create({
        data: {
          tenantId,
          sku: row.sku,
          name: row.name,
          description: req.description?.trim() || null,
          categoryId: req.categoryId,
          brandId: req.brandId || null,
          groupCode: req.groupCode || null,
          groupName: req.groupName || null,
          imageUrls: images,
          costPrice: req.costPrice ?? null,
          reorderLevel:
            req.reorderLevel != null && Number.isFinite(req.reorderLevel)
              ? Number(req.reorderLevel)
              : 10,
          pricingBasis,
          pricingUom: req.pricingUom ?? null,
          baseRate: pricingBasis === "PER_EACH" ? commercial : req.baseRate ?? null,
          sellPrice: pricingBasis === "PER_EACH" ? commercial : null,
          productStructure: "SIMPLE",
          customAttributes: row.customAttributes,
          isActive: true,
        },
      });
      out.push(product);
    }
    return out;
  });

  for (const p of created) {
    await syncAttributeIndex(tenantId, p.id, definitions, asJsonObject(p.customAttributes));
  }

  return {
    created,
    skipped,
    summary: {
      total: preview?.summary.total ?? toCreate.length + skipped.length,
      willCreate: toCreate.length,
      duplicates: skipped.filter((r) => r.status !== "invalid").length,
      invalid: skipped.filter((r) => r.status === "invalid").length,
      createdCount: created.length,
      skippedCount: skipped.length,
    },
    preview,
  };
}
