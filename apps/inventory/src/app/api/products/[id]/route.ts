import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTaxRate, suggestTaxFromHsn } from "@/lib/tax-resolution";
import { z } from "zod";

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  brandId: z.string().nullable().optional(),
  countryCode: z.string().length(2).optional(),
  taxCode: z.string().nullable().optional(),
  hsnCode: z.string().nullable().optional(),
  taxRate: z.number().min(0).nullable().optional(),
  taxIncluded: z.boolean().optional(),
  barcode: z.string().nullable().optional(),
  imageUrls: z.array(z.string().url()).nullable().optional(),
  weight: z.number().positive().nullable().optional(),
  weightUnit: z.string().nullable().optional(),
  unit: z.string().optional(),
  costPrice: z.number().nonnegative().optional(),
  sellPrice: z.number().nonnegative().optional(),
  reorderLevel: z.number().int().min(0).optional(),
  hasVariants: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/products/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, tenantId },
    include: {
      category: true,
      brand: true,
      variants: { where: { isActive: true } },
      stocks: { include: { warehouse: true } },
      priceListItems: { include: { priceList: true } },
    },
  });

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ data: product });
}

// PATCH /api/products/:id
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id") ?? undefined;
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const data = updateProductSchema.parse(body);
    const taxManuallyEdited = data.taxCode !== undefined || data.taxRate !== undefined;
    const hsnEdited = data.hsnCode !== undefined;

    const existing = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const countryCode = (data.countryCode ?? existing.countryCode ?? "IN").toUpperCase();
    let hsnCode = data.hsnCode === undefined ? existing.hsnCode : data.hsnCode;
    let taxCode = data.taxCode === undefined ? existing.taxCode : data.taxCode;
    let taxRate = data.taxRate === undefined ? existing.taxRate : data.taxRate;
    let hsnConfidence = (existing.hsnConfidence as "EXACT" | "PARTIAL" | "MISSING" | "MANUAL" | null) ?? "MISSING";
    let taxApprovalStatus = (existing.taxApprovalStatus as "APPROVED" | "PENDING_REVIEW" | null) ?? "PENDING_REVIEW";
    let taxReviewNotes = existing.taxReviewNotes ?? undefined;

    const effectiveCategoryId = data.categoryId === undefined ? existing.categoryId : data.categoryId;
    if (effectiveCategoryId && (hsnCode == null || taxCode == null || taxRate == null)) {
      const category = await prisma.productCategory.findFirst({
        where: { id: effectiveCategoryId, tenantId },
        select: { defaultHsnCode: true, defaultTaxCode: true, defaultTaxRate: true },
      });
      if (category) {
        hsnCode = hsnCode ?? category.defaultHsnCode ?? null;
        taxCode = taxCode ?? category.defaultTaxCode ?? null;
        taxRate = taxRate ?? category.defaultTaxRate ?? null;
      }
    }

    if (!taxManuallyEdited && (hsnEdited || !taxCode || taxRate === null || taxRate === undefined)) {
      const suggestion = await suggestTaxFromHsn(hsnCode);
      hsnConfidence = suggestion.confidence;
      taxCode = taxCode ?? suggestion.taxCode ?? null;
      taxRate = taxRate ?? suggestion.taxRate ?? null;
      if (suggestion.reason) taxReviewNotes = suggestion.reason;
      if (suggestion.taxCode) taxCode = suggestion.taxCode;
      if (suggestion.taxRate !== undefined) taxRate = suggestion.taxRate;
    } else if (taxManuallyEdited) {
      hsnConfidence = hsnCode ? "MANUAL" : "MISSING";
      taxReviewNotes = "Tax set manually on product update";
    }

    if (taxCode) {
      const resolved = await resolveTaxRate(tenantId, userId, countryCode, taxCode);
      if (!resolved) {
        return NextResponse.json({ error: `Invalid taxCode ${taxCode} for ${countryCode}` }, { status: 400 });
      }
      if (taxRate !== null && taxRate !== undefined && Math.abs(taxRate - resolved.rate) > 0.000001) {
        return NextResponse.json(
          { error: `taxRate ${taxRate} does not match configured rate ${resolved.rate} for ${taxCode}` },
          { status: 400 }
        );
      }
      taxRate = taxRate ?? resolved.rate;
    } else if (taxRate === null || taxRate === undefined) {
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

    const updatePayload: Record<string, unknown> = {
      ...data,
      countryCode,
      hsnCode,
      hsnConfidence,
      taxApprovalStatus,
      taxReviewNotes,
      taxApprovedAt: taxApprovalStatus === "APPROVED" ? new Date() : null,
      taxApprovedBy: taxApprovalStatus === "APPROVED" ? (userId ?? "SYSTEM") : null,
      taxCode,
      taxRate,
    };

    const product = await prisma.product.update({ where: { id }, data: updatePayload });
    return NextResponse.json({ data: product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/products/:id — soft delete
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.product.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  await prisma.product.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ data: { id } });
}
