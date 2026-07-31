import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PricingBasis,
  quotePrice,
  type AttributeDef,
  type PricingContext,
} from "@erp/pricing";
import { prisma } from "@/lib/prisma";
import { resolveAttributeDefinitions } from "@/lib/attributes";

const basisEnum = z.enum([
  "PER_EACH",
  "PER_AREA",
  "PER_WEIGHT",
  "PER_VOLUME",
  "FORMULA",
  "CUSTOM",
]);

const draftProductSchema = z.object({
  pricingBasis: basisEnum,
  baseRate: z.number().nonnegative().nullable().optional(),
  sellPrice: z.number().nonnegative().nullable().optional(),
  pricingUom: z.string().nullable().optional(),
  weight: z.number().positive().nullable().optional(),
  weightUnit: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  attributes: z.record(z.unknown()).optional(),
  attributeSchemaVersion: z.number().int().positive().optional(),
  /** Optional inline defs (e.g. unsaved editor) — merged over / replaces DB defs when provided */
  attributeDefs: z
    .array(
      z.object({
        key: z.string(),
        measureRole: z
          .enum([
            "LENGTH",
            "WIDTH",
            "HEIGHT",
            "THICKNESS",
            "AREA",
            "VOLUME",
            "WEIGHT",
            "NONE",
          ])
          .nullable()
          .optional(),
        measureUnit: z.string().nullable().optional(),
        sizePattern: z.string().nullable().optional(),
      })
    )
    .optional(),
});

const bodySchema = z
  .object({
    productId: z.string().min(1).nullable().optional(),
    draftProduct: draftProductSchema.optional(),
    variantId: z.string().optional(),
    quantity: z.number().positive().default(1),
    attributes: z.record(z.unknown()).optional(),
    customerId: z.string().optional(),
    priceListId: z.string().optional(),
    currency: z.string().default("INR"),
    discount: z
      .object({
        amount: z.number().optional(),
        percent: z.number().optional(),
      })
      .optional(),
  })
  .superRefine((body, ctx) => {
    const hasProduct = typeof body.productId === "string" && body.productId.length > 0;
    const hasDraft = body.draftProduct != null;
    if (hasProduct === hasDraft) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either productId or draftProduct (exactly one)",
        path: hasProduct ? ["draftProduct"] : ["productId"],
      });
    }
  });

function normalizeBasis(raw: string | null | undefined): PricingBasis {
  const basisRaw = raw || PricingBasis.PER_EACH;
  return (Object.values(PricingBasis) as string[]).includes(basisRaw)
    ? (basisRaw as PricingBasis)
    : PricingBasis.PER_EACH;
}

function mapAttributeDefs(defsRaw: Array<Record<string, unknown>>): AttributeDef[] {
  return defsRaw.map((d) => ({
    key: String(d.key),
    measureRole: (d.measureRole as AttributeDef["measureRole"]) ?? null,
    measureUnit: (d.measureUnit as string | null) ?? (d.unit as string | null) ?? null,
    sizePattern: (d.sizePattern as string | null) ?? null,
  }));
}

async function loadPriceListItems(
  tenantId: string,
  productId: string,
  priceListId: string | null
) {
  if (priceListId) {
    return prisma.priceListItem.findMany({
      where: {
        priceListId,
        productId,
        priceList: { tenantId, isActive: true },
      },
      select: {
        productId: true,
        variantId: true,
        minQty: true,
        price: true,
      },
    });
  }
  return prisma.priceListItem.findMany({
    where: {
      productId,
      priceList: { tenantId, isActive: true, isDefault: true },
    },
    select: {
      productId: true,
      variantId: true,
      minQty: true,
      price: true,
    },
  });
}

/**
 * POST /api/pricing/quote — commercial price quote via @erp/pricing.
 * Tax is intentionally not applied here.
 *
 * Body: either `{ productId, … }` or `{ productId: null, draftProduct, … }`.
 */
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = bodySchema.parse(await request.json());
    const priceListId = body.priceListId ?? null;
    const customerId: string | null = body.customerId ?? null;

    let ctx: PricingContext;

    if (body.draftProduct) {
      const draft = body.draftProduct;
      const attrs =
        body.attributes ?? draft.attributes ?? {};
      let attributeDefs: AttributeDef[];
      if (draft.attributeDefs?.length) {
        attributeDefs = draft.attributeDefs.map((d) => ({
          key: d.key,
          measureRole: d.measureRole ?? null,
          measureUnit: d.measureUnit ?? null,
          sizePattern: d.sizePattern ?? null,
        }));
      } else {
        const defsRaw = await resolveAttributeDefinitions(
          tenantId,
          draft.categoryId ?? undefined
        );
        attributeDefs = mapAttributeDefs(defsRaw as Array<Record<string, unknown>>);
      }

      ctx = {
        tenantId,
        currency: body.currency,
        at: new Date(),
        product: {
          id: "draft",
          pricingBasis: normalizeBasis(draft.pricingBasis),
          baseRate: draft.baseRate ?? null,
          sellPrice: draft.sellPrice ?? null,
          pricingUom: draft.pricingUom ?? null,
          weight: draft.weight ?? null,
          weightUnit: draft.weightUnit ?? null,
        },
        variant: null,
        attributes: attrs,
        attributeDefs,
        customer: customerId ? { id: customerId, priceListId } : null,
        priceListItems: [],
        quantity: body.quantity,
        discount: body.discount ?? null,
        pricingRuleVersion: draft.attributeSchemaVersion ?? 1,
      };
    } else {
      const productId = body.productId as string;
      const product = await prisma.product.findFirst({
        where: { id: productId, tenantId },
      });
      if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

      let variant = null;
      if (body.variantId) {
        variant = await prisma.productVariant.findFirst({
          where: { id: body.variantId, tenantId, productId: product.id, isActive: true },
        });
        if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });
      }

      // Product commercial attrs + variant physical measures; request attrs win last
      const productAttrs =
        (product.customAttributes as Record<string, unknown> | null) ?? {};
      const variantAttrs =
        (variant?.attributes as Record<string, unknown> | null) ?? {};
      const attrs = {
        ...productAttrs,
        ...variantAttrs,
        ...(body.attributes ?? {}),
      };

      const defsRaw = await resolveAttributeDefinitions(tenantId, product.categoryId ?? undefined);
      const attributeDefs = mapAttributeDefs(defsRaw as Array<Record<string, unknown>>);
      const priceListItems = await loadPriceListItems(tenantId, product.id, priceListId);

      ctx = {
        tenantId,
        currency: body.currency,
        at: new Date(),
        product: {
          id: product.id,
          pricingBasis: normalizeBasis(product.pricingBasis),
          baseRate: product.baseRate,
          sellPrice: product.sellPrice,
          pricingUom: product.pricingUom,
          weight: product.weight,
          weightUnit: product.weightUnit,
        },
        variant: variant
          ? {
              id: variant.id,
              sellPrice: variant.sellPrice,
              baseRate: null,
            }
          : null,
        attributes: attrs,
        attributeDefs,
        customer: customerId ? { id: customerId, priceListId } : null,
        priceListItems,
        quantity: body.quantity,
        discount: body.discount ?? null,
        pricingRuleVersion: product.attributeSchemaVersion ?? 1,
      };
    }

    const { quote, snapshot } = quotePrice(ctx);
    return NextResponse.json({ data: { quote, snapshot } });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Quote failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
