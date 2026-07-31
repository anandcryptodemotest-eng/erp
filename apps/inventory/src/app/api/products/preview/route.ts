import { NextResponse } from "next/server";
import { z } from "zod";
import { previewProductCreation } from "@/services/product-creation.engine";

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
  })
  .optional()
  .nullable();

const bodySchema = z.object({
  categoryId: z.string().min(1),
  brandId: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  axes: z.record(z.array(z.union([z.string(), z.number()])).min(1)).refine(
    (o) => Object.keys(o).length > 0,
    { message: "Select at least one attribute value" }
  ),
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

// POST /api/products/preview — Analyze → CreatePlan (no persist)
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { requireCatalogManager } = await import("@erp/auth");
  const denied = requireCatalogManager(request);
  if (denied) return denied;

  try {
    const raw = bodySchema.parse(await request.json());
    const axes: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(raw.axes)) {
      axes[k] = v.map(String);
    }
    const { plan } = await previewProductCreation(tenantId, {
      ...raw,
      axes,
      pricingPolicy: (raw.pricingPolicy ?? undefined) as import("@/lib/pricing-policy").PricingPolicy | undefined,
    });
    return NextResponse.json({ data: plan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("products/preview", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
