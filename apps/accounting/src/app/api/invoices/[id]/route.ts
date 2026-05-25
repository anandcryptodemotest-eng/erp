import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateInvoiceSchema = z.object({
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  entityName: z.string().optional(),
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "BANK_TRANSFER", "CREDIT_CARD", "CHECK", "OTHER"]),
  reference: z.string().optional(),
  date: z.string(),
});

// GET /api/invoices/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, tenantId },
    include: { payments: true, creditNotes: true },
  });

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  return NextResponse.json({ data: invoice });
}

// PATCH /api/invoices/:id?action=issue|pay|cancel
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) return NextResponse.json({ error: "Auth context required" }, { status: 400 });

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  try {
    if (!action) {
      // Plain update of editable fields (DRAFT only)
      if (invoice.status !== "DRAFT") {
        return NextResponse.json({ error: "Only DRAFT invoices can be edited" }, { status: 409 });
      }
      const body = await request.json();
      const data = updateInvoiceSchema.parse(body);
      const updated = await prisma.invoice.update({
        where: { id },
        data: { ...data, ...(data.dueDate && { dueDate: new Date(data.dueDate) }) },
      });
      return NextResponse.json({ data: updated });
    }

    if (action === "issue") {
      if (invoice.status !== "DRAFT") {
        return NextResponse.json({ error: "Only DRAFT invoices can be issued" }, { status: 409 });
      }
      const updated = await prisma.invoice.update({ where: { id }, data: { status: "ISSUED" } });
      return NextResponse.json({ data: updated });
    }

    if (action === "pay") {
      if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) {
        return NextResponse.json({ error: "Invoice is not payable in current status" }, { status: 409 });
      }
      const body = await request.json();
      const pmtData = paymentSchema.parse(body);

      const newPaidAmount = invoice.paidAmount + pmtData.amount;
      if (newPaidAmount > invoice.total) {
        return NextResponse.json({ error: "Payment exceeds invoice total" }, { status: 400 });
      }

      const newStatus = newPaidAmount >= invoice.total ? "PAID" : "PARTIALLY_PAID";

      const updated = await prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: { ...pmtData, tenantId, invoiceId: id, date: new Date(pmtData.date) },
        });
        return tx.invoice.update({
          where: { id },
          data: { paidAmount: newPaidAmount, status: newStatus },
          include: { payments: true },
        });
      });

      return NextResponse.json({ data: updated });
    }

    if (action === "cancel") {
      if (["PAID", "CANCELLED"].includes(invoice.status)) {
        return NextResponse.json({ error: `Cannot cancel invoice in ${invoice.status} status` }, { status: 409 });
      }
      const updated = await prisma.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Invalid action. Use ?action=issue|pay|cancel" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
