import { NextResponse } from "next/server";
import { buildInvoiceDocumentPayload } from "@/lib/generate-invoice";

/** GET /api/invoices/:id/document-payload — same payload as PDF generate (Studio simulate). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id") ?? undefined;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  try {
    const payload = await buildInvoiceDocumentPayload(tenantId, id, userId);
    return NextResponse.json({ data: { payload } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Payload failed";
    const status = msg === "Invoice not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
