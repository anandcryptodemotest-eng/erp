import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTaxRate } from "@/lib/tax-resolution";
import { z } from "zod";

const approvalSchema = z.object({
  decision: z.enum(["APPROVED", "PENDING_REVIEW"]),
  taxCode: z.string().optional(),
  taxRate: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

// PATCH /api/products/:id/tax-approval
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
    const data = approvalSchema.parse(body);

    const existing = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const countryCode = (existing.countryCode ?? "IN").toUpperCase();
    const taxCode = data.taxCode?.trim() || existing.taxCode || undefined;
    let taxRate = data.taxRate ?? existing.taxRate ?? undefined;

    if (data.decision === "APPROVED") {
      if (!existing.hsnCode) {
        return NextResponse.json({ error: "Cannot approve tax while HSN code is missing" }, { status: 400 });
      }
      if (!taxCode) {
        return NextResponse.json({ error: "taxCode is required for approval" }, { status: 400 });
      }

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
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        taxApprovalStatus: data.decision,
        taxReviewNotes: data.notes ?? existing.taxReviewNotes,
        taxCode,
        taxRate,
        taxApprovedAt: data.decision === "APPROVED" ? new Date() : null,
        taxApprovedBy: data.decision === "APPROVED" ? (userId ?? "SYSTEM") : null,
      },
    });

    return NextResponse.json({ data: product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
