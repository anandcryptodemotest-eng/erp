import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/orders/:id/documents/:docId — remove an OrderDocument row.
 * Blob cleanup is best-effort (URL may be local upload path).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id, docId } = await params;

  const existing = await prisma.orderDocument.findFirst({
    where: { id: docId, tenantId, salesOrderId: id },
  });
  if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await prisma.orderDocument.delete({ where: { id: docId } });
  return NextResponse.json({ data: { id: docId, deleted: true } });
}
