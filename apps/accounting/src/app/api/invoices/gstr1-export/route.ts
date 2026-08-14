import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const paramsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

/** GET /api/invoices/gstr1-export — GSTR-1 shaped extract (no GSTN push) */
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const parsed = paramsSchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    format: url.searchParams.get("format") ?? "json",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const from = parsed.data.from ? new Date(parsed.data.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      type: "RECEIVABLE",
      status: "ISSUED",
      documentKind: { in: ["TAX_INVOICE", "BILL_OF_SUPPLY"] },
      date: { gte: from, lte: to },
    },
    include: { lines: true },
    orderBy: { date: "asc" },
  });

  const b2b = invoices
    .filter((i) => i.supplyType === "B2B")
    .map((i) => ({
      invoiceNumber: i.number,
      invoiceDate: i.date.toISOString().slice(0, 10),
      buyerGstin: i.buyerGstin,
      placeOfSupply: i.placeOfSupply,
      taxableValue: i.taxableValue,
      igst: i.igst,
      cgst: i.cgst,
      sgst: i.sgst,
      total: i.total,
      irn: i.irn,
    }));

  const b2c = invoices
    .filter((i) => i.supplyType === "B2C")
    .map((i) => ({
      invoiceNumber: i.number,
      invoiceDate: i.date.toISOString().slice(0, 10),
      placeOfSupply: i.placeOfSupply,
      taxableValue: i.taxableValue,
      tax: i.tax,
      total: i.total,
    }));

  const hsnSummary: Record<string, { hsn: string; qty: number; taxableValue: number; tax: number }> = {};
  for (const inv of invoices) {
    for (const line of inv.lines) {
      const hsn = line.hsn ?? "NA";
      const key = hsn;
      if (!hsnSummary[key]) hsnSummary[key] = { hsn, qty: 0, taxableValue: 0, tax: 0 };
      hsnSummary[key].qty += line.quantity;
      hsnSummary[key].taxableValue += line.lineTotal - line.taxAmount;
      hsnSummary[key].tax += line.taxAmount;
    }
  }

  const payload = {
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    disclaimer: "Export for tax software / CA — Sankalp does not file returns",
    b2b,
    b2c,
    hsn: Object.values(hsnSummary),
    count: invoices.length,
  };

  if (parsed.data.format === "csv") {
    const rows = [
      "section,invoiceNumber,date,taxableValue,tax,total,placeOfSupply",
      ...b2b.map(
        (r) =>
          `B2B,${r.invoiceNumber},${r.invoiceDate},${r.taxableValue},${r.igst + r.cgst + r.sgst},${r.total},${r.placeOfSupply ?? ""}`
      ),
      ...b2c.map(
        (r) =>
          `B2C,${r.invoiceNumber},${r.invoiceDate},${r.taxableValue},${r.tax},${r.total},${r.placeOfSupply ?? ""}`
      ),
    ];
    return new NextResponse(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="gstr1-export.csv"`,
      },
    });
  }

  return NextResponse.json({ data: payload });
}
