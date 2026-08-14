import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  customerId: z.string().min(1),
  /** Proposed order / bill total to add to exposure */
  additionalAmount: z.number().min(0).default(0),
});

/**
 * POST /api/ar/credit-check
 * Returns outstanding AR vs customer creditLimit (sales customerId = Invoice.entityId).
 * Sales convert / Quick Bill can block when wouldExceed.
 */
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = schema.parse(await request.json());

    const open = await prisma.invoice.findMany({
      where: {
        tenantId,
        type: "RECEIVABLE",
        entityId: body.customerId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: { total: true, paidAmount: true },
    });

    const outstanding = open.reduce((s, i) => s + Math.max(0, i.total - i.paidAmount), 0);
    const projected = outstanding + body.additionalAmount;

    // creditLimit lives on sales Customer — caller may pass limit, or we return exposure only
    return NextResponse.json({
      data: {
        customerId: body.customerId,
        outstanding,
        additionalAmount: body.additionalAmount,
        projected,
        openInvoiceCount: open.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Credit check failed" }, { status: 500 });
  }
}
