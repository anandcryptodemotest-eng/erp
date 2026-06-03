import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTaxRate, suggestTaxFromHsn } from "@/lib/tax-resolution";
import { z } from "zod";

const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  countryCode: z.string().length(2).optional(),
  taxCode: z.string().optional(),
  hsnCode: z.string().optional(),
  taxRate: z.number().min(0).optional(),
  taxIncluded: z.boolean().default(false),
  barcode: z.string().optional(),
  pluCode: z.string().optional(),       // PLU for weight-based items (no barcode)
  imageUrls: z.array(z.string().url()).optional(),
  weight: z.number().positive().optional(),
  weightUnit: z.string().optional(),
  unit: z.string().default("pcs"),      // pcs | kg | g | liter | ml | dozen | bag
  sellByWeight: z.boolean().default(false), // true = price × weight at billing
  costPrice: z.number().nonnegative(),
  sellPrice: z.number().nonnegative(),  // per unit; for weight items = per kg
  reorderLevel: z.number().min(0).default(10), // Float so loose items support e.g. 5.0 kg min
  hasVariants: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
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

  const where = {
    tenantId,
    isActive: true,
    ...(search && { name: { contains: search, mode: "insensitive" as const } }),
    ...(categoryId && { categoryId }),
    ...(brandId && { brandId }),
    ...(barcode && { barcode }),
    ...(isFeatured !== undefined && { isFeatured }),
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

// POST /api/products
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id") ?? undefined;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
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

    const product = await prisma.product.create({
      data: {
        ...data,
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
      },
    });

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
