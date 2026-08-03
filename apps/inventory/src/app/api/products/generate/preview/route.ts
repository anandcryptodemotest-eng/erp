import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { previewProductCreation } from "@/services/product-creation.engine";

const log = createLogger({ service: "inventory" });

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
});

/** @deprecated Prefer POST /api/products/preview — compat wrapper */
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const raw = bodySchema.parse(await request.json());
    const axes: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(raw.axes)) {
      axes[k] = v.map(String);
    }
    const { plan, analyzed } = await previewProductCreation(tenantId, {
      ...raw,
      axes,
      productName: raw.productName ?? raw.namePrefix,
    });
    // Legacy shape for seed scripts + old clients
    return NextResponse.json({
      data: {
        ...analyzed.preview,
        plan,
        summary: {
          total: plan.total,
          willCreate: plan.create,
          duplicates: plan.skip,
          invalid: plan.invalid,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    log.error("products_generate_preview", { err: error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
