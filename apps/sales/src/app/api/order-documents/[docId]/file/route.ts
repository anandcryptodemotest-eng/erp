import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServiceUrl } from "@erp/config";
import { getServiceSecret } from "@erp/auth";

/**
 * GET /api/order-documents/:docId/file
 * Streams invoice (or other) PDF with auth — plain /api/invoices/.../pdf links fail in <a href>.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { docId } = await params;
  const doc = await prisma.orderDocument.findFirst({
    where: { id: docId, tenantId },
    include: {
      order: {
        select: {
          id: true,
          customer: { select: { portalUserId: true } },
        },
      },
    },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  if (role === "CUSTOMER") {
    if (!userId || doc.order.customer.portalUserId !== userId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
  }

  const invoiceMatch = /^\/api\/invoices\/([^/]+)\/pdf\/?$/.exec(doc.fileUrl);
  if (invoiceMatch) {
    const invoiceId = invoiceMatch[1];
    const accountingUrl = getServiceUrl("accounting");
    const secret = getServiceSecret();
    const upstream = await fetch(`${accountingUrl}/api/invoices/${invoiceId}/pdf`, {
      headers: {
        "x-tenant-id": tenantId,
        "x-service-key": secret,
        ...(userId ? { "x-user-id": userId } : {}),
      },
    });
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: errText || "Failed to load PDF" },
        { status: upstream.status }
      );
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || "application/pdf",
        "Content-Disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  // Absolute external URL — redirect (rare)
  if (/^https?:\/\//i.test(doc.fileUrl)) {
    return NextResponse.redirect(doc.fileUrl);
  }

  return NextResponse.json({ error: "Unsupported document URL" }, { status: 400 });
}
