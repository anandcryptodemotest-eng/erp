import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { invoicePdfPath } from "@erp/documents/render";
import { prisma } from "@/lib/prisma";

/** GET /api/invoices/:id/pdf — stream stored invoice PDF */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (!invoice.pdfUrl) return NextResponse.json({ error: "PDF not generated" }, { status: 404 });

  try {
    const buf = await readFile(invoicePdfPath(tenantId, id));
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
        ...(invoice.pdfChecksum ? { ETag: `"${invoice.pdfChecksum}"` } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF file missing" }, { status: 404 });
  }
}
