import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTaxRate, suggestTaxFromHsn } from "@/lib/tax-resolution";
import {
  resolveAttributeDefinitions,
  syncAttributeIndex,
  validateCustomAttributes,
} from "@/lib/attributes";
import { createProducts, isEngineCreateBody } from "@/services/product-creation.engine";
import { z } from "zod";

const log = createLogger({ service: "inventory" });

const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  groupCode: z.string().min(1).max(64).nullable().optional(),
  groupName: z.string().min(1).max(200).nullable().optional(),
  countryCode: z.string().length(2).optional(),
  taxCode: z.string().optional(),
  hsnCode: z.string().optional(),
  taxRate: z.number().min(0).optional(),
  taxIncluded: z.boolean().default(false),
  barcode: z.string().optional(),
  pluCode: z.string().optional(),
  imageUrls: z.array(z.string().min(1)).optional(),
  weight: z.number().positive().optional(),
  weightUnit: z.string().optional(),
  unit: z.string().default("pcs"),
  sellByWeight: z.boolean().default(false),
  costPrice: z.number().nonnegative().nullable().optional(),
  sellPrice: z.number().nonnegative().nullable(),
  costingMethod: z
    .enum(["MANUAL", "LAST_PURCHASE", "WEIGHTED_AVERAGE", "FIFO"])
    .optional()
    .default("MANUAL"),
  pricingBasis: z
    .enum(["PER_EACH", "PER_AREA", "PER_WEIGHT", "PER_VOLUME", "FORMULA", "CUSTOM"])
    .optional(),
  baseRate: z.number().nonnegative().optional(),
  pricingUom: z.string().optional(),
  reorderLevel: z.number().min(0).default(10),
  productStructure: z.enum(["SIMPLE", "VARIANT"]).optional().default("SIMPLE"),
  hasVariants: z.boolean().optional(),
  variantAxes: z.array(z.string().min(1)).optional(),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  customAttributes: z.record(z.unknown()).optional(),
});

const pricingPolicySchema = z
  .object({
    type: z.enum(["SAME", "CONFIGURATION"]),
    basePrice: z.number().nonnegative().nullable().optional(),
    attribute: z.string().min(1).optional(),
    values: z.record(z.number().nonnegative()).optional(),
    overrides: z.record(z.number().nonnegative()).optional(),
  })
  .optional()
  .nullable();

const mediaSchema = z
  .object({
    images: z.array(z.string().min(1)).max(4).optional().default([]),
    variation: z
      .object({
        type: z.literal("CONFIGURATION"),
        attributes: z.array(z.string().min(1)).min(1),
        values: z.record(z.array(z.string().min(1)).max(4)),
      })
      .optional()
      .nullable(),
  })
  .optional()
  .nullable();

const engineCreateSchema = z.object({
  categoryId: z.string().min(1),
  brandId: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  axes: z.record(z.array(z.union([z.string(), z.number()]))),
  skuTemplate: z.string().nullable().optional(),
  nameTemplate: z.string().nullable().optional(),
  barcodeTemplate: z.string().nullable().optional(),
  groupCode: z.string().min(1).max(64).nullable().optional(),
  groupName: z.string().min(1).max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  media: mediaSchema,
  costPrice: z.number().nonnegative().nullable().optional(),
  reorderLevel: z.number().min(0).nullable().optional(),
  openingStock: z.number().min(0).nullable().optional(),
  pricingBasis: z
    .enum(["PER_EACH", "PER_AREA", "PER_WEIGHT", "PER_VOLUME", "FORMULA", "CUSTOM"])
    .optional()
    .default("PER_EACH"),
  pricingUom: z.string().nullable().optional(),
  baseRate: z.number().nonnegative().nullable().optional(),
  sellPrice: z.number().nonnegative().nullable().optional(),
  pricingPolicy: pricingPolicySchema,
});

// GET /api/products
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const search = url.searchParams.get("search") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const brandId = url.searchParams.get("brandId") ?? undefined;
  const barcode = url.searchParams.get("barcode") ?? undefined;
  const isFeatured = url.searchParams.get("isFeatured") === "true" ? true : undefined;
  const lowStock = url.searchParams.get("lowStock") === "true";

  // Faceted filters: ?attr[grade]=BWR&attr[thickness_mm]=18
  const attrFilters: { key: string; value: string }[] = [];
  for (const [param, value] of url.searchParams.entries()) {
    const m = param.match(/^attr\[(.+)\]$/);
    if (m && value) attrFilters.push({ key: m[1], value });
  }

  let productIdsFromAttrs: string[] | undefined;
  if (attrFilters.length) {
    const matched = await prisma.productAttributeIndex.findMany({
      where: {
        tenantId,
        OR: attrFilters.map((f) => ({
          key: f.key,
          OR: [
            { valueText: f.value },
            ...(Number.isNaN(Number(f.value)) ? [] : [{ valueNum: Number(f.value) }]),
          ],
        })),
      },
      select: { productId: true, key: true },
    });
    const byProduct = new Map<string, Set<string>>();
    for (const row of matched) {
      if (!byProduct.has(row.productId)) byProduct.set(row.productId, new Set());
      byProduct.get(row.productId)!.add(row.key);
    }
    const needed = new Set(attrFilters.map((f) => f.key));
    productIdsFromAttrs = [...byProduct.entries()]
      .filter(([, keys]) => [...needed].every((k) => keys.has(k)))
      .map(([id]) => id);
    if (productIdsFromAttrs.length === 0) {
      return NextResponse.json({ data: [], meta: { page, limit, total: 0, pages: 0 } });
    }
  }

  const where = {
    tenantId,
    isActive: true,
    ...(search && { name: { contains: search, mode: "insensitive" as const } }),
    ...(categoryId && { categoryId }),
    ...(brandId && { brandId }),
    ...(barcode && { barcode }),
    ...(isFeatured !== undefined && { isFeatured }),
    ...(productIdsFromAttrs && { id: { in: productIdsFromAttrs } }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        stocks: { include: { warehouse: { select: { id: true, name: true } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  // If lowStock filter requested, post-filter by reorder level
  const data = lowStock
    ? products.filter((p) => p.stocks.some((s) => s.quantity <= p.reorderLevel))
    : products;

  return NextResponse.json({ data, meta: { page, limit, total: lowStock ? data.length : total, pages: Math.ceil((lowStock ? data.length : total) / limit) } });
}

// POST /api/products — façade: single SKU body OR axes → ProductCreationEngine
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id") ?? undefined;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { requireCatalogManager } = await import("@erp/auth");
  const denied = requireCatalogManager(request);
  if (denied) return denied;

  try {
    const body = await request.json();

    if (isEngineCreateBody(body)) {
      const raw = engineCreateSchema.parse(body);
      const axes: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(raw.axes)) {
        if (Array.isArray(v) && v.length) axes[k] = v.map(String);
      }
      if (Object.keys(axes).length === 0) {
        return NextResponse.json({ error: "Select at least one attribute value" }, { status: 400 });
      }
      const result = await createProducts(tenantId, {
        ...raw,
        axes,
        pricingPolicy: (raw.pricingPolicy ?? undefined) as import("@/lib/pricing-policy").PricingPolicy | undefined,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: { plan: result.plan } }, { status: 400 });
      }
      return NextResponse.json(
        {
          data: {
            created: result.created,
            skipped: result.skipped,
            plan: result.plan,
            summary: result.summary,
          },
        },
        { status: 201 }
      );
    }

    const data = createProductSchema.parse(body);
    const countryCode = (data.countryCode ?? "IN").toUpperCase();

    let taxCode = data.taxCode?.trim() || undefined;
    let taxRate = data.taxRate;
    let hsnCode = data.hsnCode?.trim() || undefined;
    let hsnConfidence: "EXACT" | "PARTIAL" | "MISSING" | "MANUAL" = "MISSING";
    let taxApprovalStatus: "APPROVED" | "PENDING_REVIEW" = "PENDING_REVIEW";
    let taxReviewNotes: string | undefined;

    if (data.categoryId && (taxCode === undefined || taxRate === undefined)) {
      const category = await prisma.productCategory.findFirst({
        where: { id: data.categoryId, tenantId },
        select: { defaultHsnCode: true, defaultTaxCode: true, defaultTaxRate: true },
      });
      if (category) {
        hsnCode = hsnCode ?? category.defaultHsnCode ?? undefined;
        taxCode = taxCode ?? category.defaultTaxCode ?? undefined;
        taxRate = taxRate ?? category.defaultTaxRate ?? undefined;
      }
    }

    if (!taxCode || taxRate === undefined) {
      const suggestion = await suggestTaxFromHsn(hsnCode);
      hsnConfidence = suggestion.confidence;
      if (!taxCode) taxCode = suggestion.taxCode;
      if (taxRate === undefined) taxRate = suggestion.taxRate;
      if (suggestion.reason) taxReviewNotes = suggestion.reason;
    } else {
      hsnConfidence = hsnCode ? "MANUAL" : "MISSING";
      taxReviewNotes = "Tax set manually on product";
    }

    if (taxCode) {
      const resolved = await resolveTaxRate(tenantId, userId, countryCode, taxCode);
      if (!resolved) {
        return NextResponse.json({ error: `Invalid taxCode ${taxCode} for ${countryCode}` }, { status: 400 });
      }
      if (taxRate !== undefined && Math.abs(taxRate - resolved.rate) > 0.000001) {
        return NextResponse.json(
          { error: `taxRate ${taxRate} does not match configured rate ${resolved.rate} for ${taxCode}` },
          { status: 400 }
        );
      }
      taxRate = taxRate ?? resolved.rate;
    } else if (taxRate === undefined) {
      const resolvedDefault = await resolveTaxRate(tenantId, userId, countryCode);
      if (resolvedDefault) {
        taxCode = resolvedDefault.code;
        taxRate = resolvedDefault.rate;
      }
    }

    if (!hsnCode) {
      hsnConfidence = "MISSING";
      taxApprovalStatus = "PENDING_REVIEW";
      taxReviewNotes = taxReviewNotes ?? "Missing HSN. Manager approval required before billing.";
    } else if (hsnConfidence === "EXACT" || hsnConfidence === "MANUAL") {
      taxApprovalStatus = "APPROVED";
      taxReviewNotes = taxReviewNotes ?? "Auto-approved tax from exact HSN/manual assignment.";
    } else {
      taxApprovalStatus = "PENDING_REVIEW";
      taxReviewNotes = taxReviewNotes ?? "Partial HSN match. Manager approval required.";
    }

    const definitions = await resolveAttributeDefinitions(tenantId, data.categoryId);
    const attrResult = validateCustomAttributes(definitions, data.customAttributes);
    if (!attrResult.ok) {
      return NextResponse.json({ error: attrResult.error }, { status: 400 });
    }

    const identityKeys = definitions.filter((d) => d.isIdentity).map((d) => d.key);
    if (identityKeys.length) {
      const brand = data.brandId
        ? await prisma.brand.findFirst({ where: { id: data.brandId, tenantId }, select: { name: true } })
        : null;
      const { findIdentityDuplicate } = await import("@/lib/identity-fingerprint");
      const dup = await findIdentityDuplicate({
        tenantId,
        brandId: data.brandId,
        brandName: brand?.name || "",
        identityKeys,
        attrs: attrResult.values,
      });
      if (dup) {
        return NextResponse.json(
          { error: `A product with the same identity already exists (SKU ${dup.sku})` },
          { status: 409 }
        );
      }
    }

    const { customAttributes: _ca, hasVariants, variantAxes, productStructure, ...productFields } =
      data;
    const structure =
      hasVariants === true
        ? "VARIANT"
        : hasVariants === false
          ? "SIMPLE"
          : productStructure ?? "SIMPLE";
    const product = await prisma.product.create({
      data: {
        ...productFields,
        productStructure: structure,
        variantAxes: variantAxes ?? [],
        costPrice: productFields.costPrice ?? null,
        sellPrice: productFields.sellPrice ?? null,
        tenantId,
        countryCode,
        hsnCode,
        hsnConfidence,
        taxApprovalStatus,
        taxReviewNotes,
        taxApprovedAt: taxApprovalStatus === "APPROVED" ? new Date() : undefined,
        taxApprovedBy: taxApprovalStatus === "APPROVED" ? (userId ?? "SYSTEM") : undefined,
        taxCode,
        taxRate,
        customAttributes: attrResult.values as object,
      },
    });

    await syncAttributeIndex(tenantId, product.id, definitions, attrResult.values);

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
    }
    log.error("products_post", { err: error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
