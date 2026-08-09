import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { invoicePdfPath } from "@erp/documents/render";
import { prisma } from "@/lib/prisma";
import { generateInvoice } from "@/lib/generate-invoice";

async function readPdf(tenantId: string, invoiceId: string) {
  return readFile(invoicePdfPath(tenantId, invoiceId));
}

/** GET /api/invoices/:id/pdf — stream stored invoice PDF (re-render if file missing). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  let buf: Buffer;
  try {
    buf = await readPdf(tenantId, id);
  } catch {
    if (!invoice.sourceRef) {
      return NextResponse.json({ error: "PDF file missing" }, { status: 404 });
    }
    try {
      await generateInvoice({
        tenantId,
        userId: request.headers.get("x-user-id") ?? undefined,
        salesOrderId: invoice.sourceRef,
        force: true,
        issue: false,
      });
      buf = await readPdf(tenantId, id);
    } catch {
      return NextResponse.json({ error: "PDF not generated" }, { status: 404 });
    }
  }

  return new NextResponse(Uint8Array.from(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
      ...(invoice.pdfChecksum ? { ETag: `"${invoice.pdfChecksum}"` } : {}),
    },
  });
}
