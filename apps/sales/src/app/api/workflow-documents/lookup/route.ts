import { NextResponse } from "next/server";
import { getDocumentByRef, getPublishedDocument } from "@/lib/document-catalog";

/**
 * GET /api/workflow-documents/lookup?documentId=&version=
 * Service-friendly published document resolve (no process-designer gate).
 */
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");
  if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });
  const version = url.searchParams.get("version");

  const pub = version
    ? await getDocumentByRef(tenantId, { id: documentId, version: Number(version) })
    : await getPublishedDocument(tenantId, documentId);

  if (!pub) {
    // Auto-seed tax-invoice once for tenants missing catalog
    if (documentId === "tax-invoice") {
      const { ensureDocumentCatalogSeed } = await import("@/lib/document-catalog");
      await ensureDocumentCatalogSeed(tenantId, { force: true });
      const again = version
        ? await getDocumentByRef(tenantId, { id: documentId, version: Number(version) })
        : await getPublishedDocument(tenantId, documentId);
      if (again) return NextResponse.json({ data: again });
    }
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json({ data: pub });
}
