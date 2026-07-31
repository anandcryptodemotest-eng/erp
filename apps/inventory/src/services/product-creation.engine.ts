/**
 * ProductCreationEngine — Platform v1.0 create pipeline.
 *
 * Analyze → PricingPolicy.resolve → CreatePlan → Preview | Persist
 * Preview and Persist share the same CreatePlan (no second Analyze).
 */

import { PricingBasis, quotePrice, type AttributeDef, type PricingContext } from "@erp/pricing";
import { resolveAttributeDefinitions } from "@/lib/attributes";
import {
  normalizePricingPolicy,
  resolvePrice,
  type PriceSource,
  type PricingPolicy,
  type ResolvedPrice,
} from "@/lib/pricing-policy";
import {
  persistGeneratedRows,
  previewProductGeneration,
  type GeneratePreviewRow,
  type GenerateRequest,
} from "@/services/product-generation.service";

export type ProductCreationRequest = {
  categoryId: string;
  brandId?: string | null;
  productName?: string | null;
  axes: Record<string, string[]>;
  skuTemplate?: string | null;
  nameTemplate?: string | null;
  barcodeTemplate?: string | null;
  pricingBasis?: string;
  pricingUom?: string | null;
  baseRate?: number | null;
  sellPrice?: number | null;
  groupCode?: string | null;
  groupName?: string | null;
  /** Customer-facing commercial description (copied to every SKU in v1). */
  description?: string | null;
  /** Commercial media wrapper — maps to Product.imageUrls on persist. */
  media?: { images: string[] } | null;
  costPrice?: number | null;
  reorderLevel?: number | null;
  /** Opening qty applied after create (caller or engine stock receive). */
  openingStock?: number | null;
  /** First-class commercial policy (PER_EACH variation). */
  pricingPolicy?: PricingPolicy | null;
};

export type CreatePlanRowStatus = "willCreate" | "alreadyExists" | "invalid";

export type CreatePlanProduct = {
  index: number;
  status: CreatePlanRowStatus;
  sku: string;
  name: string;
  unitPrice: number | null;
  sellPrice: number | null;
  priceSource: PriceSource | null;
  priceDetail?: string;
  existingSku?: string;
  customAttributes: Record<string, string>;
  fingerprint?: string | null;
};

export type CreatePlan = {
  total: number;
  create: number;
  skip: number;
  invalid: number;
  warnings: string[];
  products: CreatePlanProduct[];
  pricingPolicy: PricingPolicy;
};

export type AnalyzeResult = {
  request: GenerateRequest;
  preview: Awaited<ReturnType<typeof previewProductGeneration>>;
  pricingPolicy: PricingPolicy;
  pricingBasis: string;
  attrLabels: Record<string, string>;
};

function toGenerateRequest(req: ProductCreationRequest, policy: PricingPolicy): GenerateRequest {
  const pricingBasis = req.pricingBasis || "PER_EACH";
  const baseRate =
    pricingBasis === "PER_EACH"
      ? (policy.basePrice ?? req.sellPrice ?? req.baseRate ?? null)
      : (req.baseRate ?? null);

  const images = (req.media?.images ?? []).filter((u) => typeof u === "string" && u.trim());
  return {
    categoryId: req.categoryId,
    brandId: req.brandId ?? null,
    axes: req.axes,
    skuTemplate: req.skuTemplate ?? null,
    nameTemplate: req.nameTemplate ?? null,
    namePrefix: req.productName?.trim() || null,
    groupCode: req.groupCode?.trim() || null,
    groupName: req.groupName?.trim() || req.productName?.trim() || null,
    description: req.description?.trim() || null,
    media: images.length ? { images } : null,
    costPrice: req.costPrice ?? null,
    reorderLevel: req.reorderLevel ?? null,
    pricingBasis,
    pricingUom: pricingBasis === "PER_EACH" ? "each" : req.pricingUom ?? null,
    baseRate,
  };
}

function mapStatus(status: GeneratePreviewRow["status"]): CreatePlanRowStatus {
  if (status === "new") return "willCreate";
  if (status === "invalid") return "invalid";
  return "alreadyExists";
}

function normalizeBasis(raw: string | null | undefined): PricingBasis {
  const basisRaw = raw || PricingBasis.PER_EACH;
  return (Object.values(PricingBasis) as string[]).includes(basisRaw)
    ? (basisRaw as PricingBasis)
    : PricingBasis.PER_EACH;
}

async function measuredUnitPrice(
  tenantId: string,
  req: GenerateRequest,
  row: GeneratePreviewRow
): Promise<number | null> {
  try {
    const basis = normalizeBasis(req.pricingBasis);
    const defsRaw = await resolveAttributeDefinitions(tenantId, req.categoryId);
    const attributeDefs: AttributeDef[] = defsRaw.map((d) => ({
      key: d.key,
      measureRole: (d.measureRole as AttributeDef["measureRole"]) ?? null,
      measureUnit: d.measureUnit ?? d.unit ?? null,
      sizePattern: d.sizePattern ?? null,
    }));
    const ctx: PricingContext = {
      tenantId,
      currency: "INR",
      at: new Date(),
      product: {
        id: "draft",
        pricingBasis: basis,
        baseRate: req.baseRate ?? null,
        sellPrice: null,
        pricingUom: req.pricingUom ?? null,
        weight: null,
        weightUnit: null,
      },
      variant: null,
      attributes: row.customAttributes,
      attributeDefs,
      customer: null,
      priceListItems: [],
      quantity: 1,
      discount: null,
      pricingRuleVersion: 1,
    };
    const { quote } = quotePrice(ctx);
    return Number.isFinite(quote.unitPrice) ? quote.unitPrice : null;
  } catch {
    return null;
  }
}

/** AnalyzeRequest — combinations + duplicates + attach normalized PricingPolicy. */
export async function analyzeRequest(
  tenantId: string,
  req: ProductCreationRequest
): Promise<AnalyzeResult> {
  const pricingBasis = req.pricingBasis || "PER_EACH";
  const fallbackBase =
    pricingBasis === "PER_EACH"
      ? (req.pricingPolicy?.basePrice ?? req.sellPrice ?? req.baseRate ?? null)
      : null;
  const pricingPolicy = normalizePricingPolicy(req.pricingPolicy, fallbackBase);
  if (pricingBasis !== "PER_EACH") {
    // Measured: force SAME commercially; rate lives on generate request
    pricingPolicy.type = "SAME";
    pricingPolicy.attribute = undefined;
    pricingPolicy.values = undefined;
  }

  const request = toGenerateRequest(req, pricingPolicy);
  const preview = await previewProductGeneration(tenantId, request);

  const defs = await resolveAttributeDefinitions(tenantId, req.categoryId);
  const attrLabels: Record<string, string> = {};
  for (const d of defs) attrLabels[d.key] = d.label;

  return { request, preview, pricingPolicy, pricingBasis, attrLabels };
}

/** BuildCreatePlan — policy.resolve per row; measured uses quote engine. */
export async function buildCreatePlan(
  tenantId: string,
  analyzed: AnalyzeResult
): Promise<CreatePlan> {
  const { request, preview, pricingPolicy, pricingBasis, attrLabels } = analyzed;
  const warnings = preview.issues.map((i) => i.message);
  const isEach = pricingBasis === "PER_EACH";

  const products: CreatePlanProduct[] = [];
  for (const row of preview.rows) {
    const status = mapStatus(row.status);
    let unitPrice: number | null = null;
    let sellPrice: number | null = null;
    let priceSource: PriceSource | null = null;
    let priceDetail: string | undefined;

    if (status !== "invalid") {
      if (isEach) {
        const resolved: ResolvedPrice = resolvePrice(
          pricingPolicy,
          {
            index: row.index,
            fingerprint: row.fingerprint,
            customAttributes: row.customAttributes,
          },
          pricingPolicy.attribute ? attrLabels[pricingPolicy.attribute] : undefined
        );
        unitPrice = resolved.amount;
        sellPrice = resolved.amount;
        priceSource = resolved.source;
        priceDetail = resolved.detail;
      } else {
        unitPrice = await measuredUnitPrice(tenantId, request, row);
        sellPrice = null;
        priceSource = "MEASURED";
        priceDetail = request.baseRate != null ? `Rate ${request.baseRate}/${request.pricingUom || "unit"}` : undefined;
      }
    }

    products.push({
      index: row.index,
      status,
      sku: row.sku,
      name: row.name,
      unitPrice,
      sellPrice,
      priceSource,
      priceDetail,
      existingSku: row.existingSku,
      customAttributes: row.customAttributes,
      fingerprint: row.fingerprint,
    });
  }

  return {
    total: preview.summary.total,
    create: preview.summary.willCreate,
    skip: preview.summary.duplicates,
    invalid: preview.summary.invalid,
    warnings,
    products,
    pricingPolicy,
  };
}

export function validate(plan: CreatePlan, analyzed: AnalyzeResult): string | null {
  const blocking = analyzed.preview.issues.filter((i) =>
    ["EMPTY_AXES", "MISSING_PRICING_DEFAULTS", "BAD_SKU_TEMPLATE"].includes(i.code)
  );
  if (blocking.length && plan.create === 0) {
    return blocking[0]?.message || "Validation failed";
  }
  if (plan.total === 0) {
    return "Select at least one attribute value";
  }
  if (analyzed.pricingBasis === "PER_EACH" && plan.pricingPolicy.type === "CONFIGURATION") {
    if (!plan.pricingPolicy.attribute) {
      return "Select which configuration the price varies by";
    }
  }
  return null;
}

/** Persist from CreatePlan only — no second Analyze; commercial amounts from the plan. */
export async function persist(tenantId: string, analyzed: AnalyzeResult, plan: CreatePlan) {
  const rowCommercialPrices: Record<number, number | null> = {};
  const toCreate: GeneratePreviewRow[] = [];
  const skipped: GeneratePreviewRow[] = [];

  for (const p of plan.products) {
    const genRow: GeneratePreviewRow = {
      index: p.index,
      sku: p.sku,
      name: p.name,
      configKey: p.fingerprint || `row-${p.index}`,
      customAttributes: p.customAttributes,
      status:
        p.status === "willCreate"
          ? "new"
          : p.status === "invalid"
            ? "invalid"
            : "duplicate_sku",
      fingerprint: p.fingerprint ?? null,
      existingSku: p.existingSku,
    };
    if (p.status === "willCreate") {
      toCreate.push(genRow);
      rowCommercialPrices[p.index] =
        analyzed.pricingBasis === "PER_EACH" ? p.sellPrice : analyzed.request.baseRate ?? null;
    } else {
      skipped.push(genRow);
    }
  }

  return persistGeneratedRows(
    tenantId,
    { ...analyzed.request, rowCommercialPrices },
    toCreate,
    skipped,
    analyzed.preview
  );
}

/** Preview: Analyze once → CreatePlan (no persist). */
export async function previewProductCreation(tenantId: string, req: ProductCreationRequest) {
  const analyzed = await analyzeRequest(tenantId, req);
  const plan = await buildCreatePlan(tenantId, analyzed);
  return { plan, analyzed };
}

/** Create: Analyze → CreatePlan → Validate → Persist(same plan). */
export async function createProducts(tenantId: string, req: ProductCreationRequest) {
  const analyzed = await analyzeRequest(tenantId, req);
  const plan = await buildCreatePlan(tenantId, analyzed);
  const error = validate(plan, analyzed);
  if (error) {
    return { ok: false as const, error, plan };
  }
  if (plan.create === 0) {
    return {
      ok: true as const,
      plan,
      created: [] as Awaited<ReturnType<typeof persist>> extends { created: infer C } ? C : never,
      skipped: analyzed.preview.rows.filter((r) => r.status !== "new"),
      summary: {
        createdCount: 0,
        skippedCount: plan.skip,
        total: plan.total,
        create: 0,
        skip: plan.skip,
      },
    };
  }
  const result = await persist(tenantId, analyzed, plan);
  if (result && typeof result === "object" && "error" in result && (result as { error?: string }).error === "VALIDATION") {
    return {
      ok: false as const,
      error: "Validation failed",
      plan,
      issues: (result as { issues?: unknown }).issues,
    };
  }
  return {
    ok: true as const,
    plan,
    created: "created" in result ? result.created : [],
    skipped: "skipped" in result ? result.skipped : [],
    summary: {
      createdCount: "summary" in result ? (result.summary as { createdCount?: number }).createdCount ?? 0 : 0,
      skippedCount:
        "summary" in result ? (result.summary as { skippedCount?: number }).skippedCount ?? plan.skip : plan.skip,
      total: plan.total,
      create: plan.create,
      skip: plan.skip,
    },
  };
}

export function isEngineCreateBody(body: unknown): body is ProductCreationRequest {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  return typeof o.categoryId === "string" && o.axes != null && typeof o.axes === "object";
}
