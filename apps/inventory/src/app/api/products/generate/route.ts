import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createProducts } from "@/services/product-creation.engine";

const log = createLogger({ service: "inventory" });

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

const bodySchema = z.object({
  categoryId: z.string().min(1),
  brandId: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  axes: z.record(z.array(z.union([z.string(), z.number()])).min(1)).refine(
    (o) => Object.keys(o).length > 0,
    { message: "At least one attribute axis required" }
  ),
  skuTemplate: z.string().nullable().optional(),
  nameTemplate: z.string().nullable().optional(),
  namePrefix: z.string().nullable().optional(),
  groupCode: z.string().min(1).max(64).nullable().optional(),
  groupName: z.string().min(1).max(200).nullable().optional(),
  pricingBasis: z
    .enum(["PER_EACH", "PER_AREA", "PER_WEIGHT", "PER_VOLUME", "FORMULA", "CUSTOM"])
    .optional()
    .default("PER_EACH"),
  pricingUom: z.string().nullable().optional(),
  baseRate: z.number().nonnegative().nullable().optional(),
  sellPrice: z.number().nonnegative().nullable().optional(),
  pricingPolicy: pricingPolicySchema,
});

/** @deprecated Prefer POST /api/products with axes — compat wrapper around ProductCreationEngine */
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
    const result = await createProducts(tenantId, {
      ...raw,
      axes,
      productName: raw.productName ?? raw.namePrefix,
      pricingPolicy: (raw.pricingPolicy ?? undefined) as import("@/lib/pricing-policy").PricingPolicy | undefined,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, data: { plan: result.plan } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        data: {
          created: result.created,
          skipped: result.skipped,
          summary: result.summary,
          plan: result.plan,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Duplicate SKU" }, { status: 409 });
    }
    log.error("products_generate", { err: error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
