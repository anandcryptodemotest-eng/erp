import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function bucketFor(daysPastDue: number): "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus" {
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "d1_30";
  if (daysPastDue <= 60) return "d31_60";
  if (daysPastDue <= 90) return "d61_90";
  return "d90_plus";
}

/** GET /api/ar/ageing — outstanding RECEIVABLE invoices + ageing buckets (same Invoice row) */
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const entityId = url.searchParams.get("entityId") ?? undefined;

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      type: "RECEIVABLE",
      status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      ...(entityId ? { entityId } : {}),
    },
    include: { payments: { orderBy: { date: "desc" }, take: 5 } },
    orderBy: { dueDate: "asc" },
  });

  const today = new Date();
  const buckets = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90_plus: 0,
  };

  const rows = invoices.map((inv) => {
    const outstanding = Math.max(0, inv.total - inv.paidAmount);
    const daysPastDue = daysBetween(today, inv.dueDate);
    const bucket = bucketFor(daysPastDue);
    buckets[bucket] += outstanding;
    return {
      id: inv.id,
      number: inv.number,
      entityId: inv.entityId,
      entityName: inv.entityName,
      sourceRef: inv.sourceRef,
      sourceKind: inv.sourceKind,
      documentKind: inv.documentKind,
      date: inv.date,
      dueDate: inv.dueDate,
      total: inv.total,
      paidAmount: inv.paidAmount,
      outstanding,
      status: inv.status,
      daysPastDue,
      bucket,
      pdfUrl: inv.pdfUrl,
      paymentCount: inv.payments.length,
    };
  });

  const byCustomer: Record<
    string,
    { entityId: string; entityName: string; outstanding: number; invoiceCount: number }
  > = {};
  for (const r of rows) {
    const key = r.entityId ?? r.entityName ?? "unknown";
    if (!byCustomer[key]) {
      byCustomer[key] = {
        entityId: r.entityId ?? key,
        entityName: r.entityName ?? "Unknown",
        outstanding: 0,
        invoiceCount: 0,
      };
    }
    byCustomer[key].outstanding += r.outstanding;
    byCustomer[key].invoiceCount += 1;
  }

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  return NextResponse.json({
    data: {
      asOf: today.toISOString(),
      totalOutstanding,
      invoiceCount: rows.length,
      buckets,
      customers: Object.values(byCustomer).sort((a, b) => b.outstanding - a.outstanding),
      invoices: rows,
    },
  });
}
