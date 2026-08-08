import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const reportQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

const MAX_REPORT_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;
const MAX_DISCREPANCIES = 100;
const EPSILON = 0.005;

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const query = reportQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!query.success) return NextResponse.json({ error: query.error.errors[0].message }, { status: 400 });

  const from = query.data.from ? new Date(query.data.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = query.data.to ? new Date(query.data.to) : new Date();
  if (from > to) return NextResponse.json({ error: "from must be before to" }, { status: 400 });
  if (to.getTime() - from.getTime() > MAX_REPORT_WINDOW_MS) {
    return NextResponse.json({ error: "Report range cannot exceed 366 days" }, { status: 400 });
  }

  const invoiceWhere = { tenantId, date: { gte: from, lte: to } };
  const journalWhere = { tenantId, date: { gte: from, lte: to }, isPosted: true };
  const [invoiceTotals, paymentTotals, invoiceRows, creditTotals, debitTotals, journalTotals, journalLineTotals, journalCount] = await Promise.all([
    prisma.invoice.aggregate({ where: invoiceWhere, _count: { id: true }, _sum: { total: true, paidAmount: true } }),
    prisma.payment.aggregate({ where: { tenantId, invoice: { date: { gte: from, lte: to } } }, _sum: { amount: true }, _count: { id: true } }),
    prisma.invoice.findMany({ where: invoiceWhere, select: { id: true, number: true, paidAmount: true }, take: MAX_DISCREPANCIES + 1, orderBy: { date: "desc" } }),
    prisma.creditNote.aggregate({ where: { tenantId, date: { gte: from, lte: to } }, _count: { id: true }, _sum: { amount: true } }),
    prisma.debitNote.aggregate({ where: { tenantId, date: { gte: from, lte: to } }, _count: { id: true }, _sum: { amount: true } }),
    prisma.journalEntryLine.aggregate({ where: { entry: journalWhere }, _sum: { debit: true, credit: true } }),
    prisma.journalEntryLine.groupBy({ by: ["journalEntryId"], where: { entry: journalWhere }, _sum: { debit: true, credit: true } }),
    prisma.journalEntry.count({ where: journalWhere }),
  ]);

  if (invoiceRows.length > MAX_DISCREPANCIES) {
    return NextResponse.json({ error: "Report contains too many invoices; narrow the date range" }, { status: 400 });
  }

  const paymentsByInvoice = await prisma.payment.groupBy({
    by: ["invoiceId"],
    where: { tenantId, invoice: { date: { gte: from, lte: to } } },
    _sum: { amount: true },
  });
  const paymentMap = new Map(paymentsByInvoice.map((row) => [row.invoiceId, row._sum.amount ?? 0]));
  const invoiceDiscrepancies = invoiceRows
    .map((invoice) => ({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      recordedPaidAmount: invoice.paidAmount,
      paymentTotal: paymentMap.get(invoice.id) ?? 0,
      difference: invoice.paidAmount - (paymentMap.get(invoice.id) ?? 0),
    }))
    .filter((row) => Math.abs(row.difference) > EPSILON)
    .slice(0, MAX_DISCREPANCIES);

  const debit = journalTotals._sum.debit ?? 0;
  const credit = journalTotals._sum.credit ?? 0;
  const journalDiscrepancies = journalLineTotals
    .map((row) => ({ journalEntryId: row.journalEntryId, debit: row._sum.debit ?? 0, credit: row._sum.credit ?? 0, difference: (row._sum.debit ?? 0) - (row._sum.credit ?? 0) }))
    .filter((row) => Math.abs(row.difference) > EPSILON)
    .slice(0, MAX_DISCREPANCIES);

  return NextResponse.json({
    data: {
      period: { from: from.toISOString(), to: to.toISOString() },
      invoices: {
        count: invoiceTotals._count.id,
        total: invoiceTotals._sum.total ?? 0,
        recordedPaidAmount: invoiceTotals._sum.paidAmount ?? 0,
        paymentTotal: paymentTotals._sum.amount ?? 0,
        paymentCount: paymentTotals._count.id,
        outstanding: (invoiceTotals._sum.total ?? 0) - (invoiceTotals._sum.paidAmount ?? 0),
        discrepancies: invoiceDiscrepancies,
      },
      notes: {
        credit: { count: creditTotals._count.id, total: creditTotals._sum.amount ?? 0 },
        debit: { count: debitTotals._count.id, total: debitTotals._sum.amount ?? 0 },
      },
      journals: {
        count: journalCount,
        debit,
        credit,
        difference: debit - credit,
        balanced: Math.abs(debit - credit) <= EPSILON,
        discrepancies: journalDiscrepancies,
      },
      trialBalance: { debit, credit, difference: debit - credit, balanced: Math.abs(debit - credit) <= EPSILON },
      limits: { discrepancies: MAX_DISCREPANCIES },
    },
  });
}
