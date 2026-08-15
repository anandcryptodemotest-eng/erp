import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string; docId: string }> };

/** DELETE /api/sales-requests/:id/documents/:docId — owner or staff; OPEN SREQ only for customer. */
export async function DELETE(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const { id, docId } = await params;
  const sreq = await prisma.salesRequest.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, customerId: true },
  });
  if (!sreq) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  if (role === "CUSTOMER") {
    const me = await prisma.customer.findFirst({
      where: { tenantId, portalUserId: userId, isActive: true },
      select: { id: true },
    });
    if (!me || me.id !== sreq.customerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (sreq.status !== "OPEN") {
      return NextResponse.json({ error: "Cannot remove attachments after conversion" }, { status: 409 });
    }
  }

  const doc = await prisma.salesRequestDocument.findFirst({
    where: { id: docId, tenantId, salesRequestId: id },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await prisma.salesRequestDocument.delete({ where: { id: doc.id } });
  return NextResponse.json({ data: { ok: true } });
}
