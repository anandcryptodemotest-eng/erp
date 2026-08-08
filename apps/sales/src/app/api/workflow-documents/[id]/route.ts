import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getDocumentByRef, publishDocumentVersion, cloneDocumentToDraft } from "@/lib/document-catalog";
import type { DocumentDefinition } from "@erp/documents";
import { renderDocumentHtml } from "@erp/documents/render";

const log = createLogger({ service: "sales" });

/** GET /api/workflow-documents/:id — by record id */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const url = new URL(request.url);
  // Support ?documentId=&version= for published asset lookup (accounting generate)
  const documentId = url.searchParams.get("documentId");
  const version = url.searchParams.get("version");
  if (documentId && version) {
    const pub = await getDocumentByRef(tenantId, { id: documentId, version: Number(version) });
    if (!pub) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    return NextResponse.json({ data: { ...pub, documentId: pub.ref.id, version: pub.ref.version } });
  }

  const row = await prisma.documentTemplateVersion.findFirst({ where: { id, tenantId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: row });
}

/** PATCH /api/workflow-documents/:id — update draft definition, publish, or clone-to-draft */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { requireProcessDesignerFromRequest } = await import("@erp/auth");
  const gate = await requireProcessDesignerFromRequest(request);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  try {
    const body = await request.json();
    if (body.action === "publish") {
      const row = await publishDocumentVersion(tenantId, id);
      return NextResponse.json({ data: row });
    }
    if (body.action === "clone-to-draft") {
      const draft = await cloneDocumentToDraft(tenantId, id);
      return NextResponse.json({ data: draft }, { status: 201 });
    }

    const row = await prisma.documentTemplateVersion.findFirst({ where: { id, tenantId } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.lifecycle !== "DRAFT") {
      return NextResponse.json({ error: "Only DRAFT documents can be edited" }, { status: 409 });
    }

    const updated = await prisma.documentTemplateVersion.update({
      where: { id },
      data: {
        ...(body.name != null ? { name: String(body.name) } : {}),
        ...(body.documentType != null ? { documentType: String(body.documentType) } : {}),
        ...(body.definition != null
          ? { definition: body.definition as Prisma.InputJsonValue }
          : {}),
      },
    });
    return NextResponse.json({ data: updated });
  } catch (e: unknown) {
    log.error("workflow_documents_patch", { err: e });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    );
  }
}

/** POST /api/workflow-documents/:id?action=preview — HTML preview */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;
  const url = new URL(request.url);
  if (url.searchParams.get("action") !== "preview") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const row = await prisma.documentTemplateVersion.findFirst({ where: { id, tenantId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const payload = (body.payload as Record<string, unknown>) ?? samplePayload();
  // Draft edits aren't persisted until Save — allow the Studio to preview an in-memory
  // definition (unsaved changes) instead of always re-rendering the last saved version.
  const definition = (body.definition as DocumentDefinition | undefined) ?? (row.definition as unknown as DocumentDefinition);
  const html = renderDocumentHtml(definition, payload, {
    interactive: Boolean(body.interactive),
    selectedId: typeof body.selectedId === "string" ? body.selectedId : null,
  });
  return NextResponse.json({ data: { html } });
}

function samplePayload(): Record<string, unknown> {
  return {
    invoice: { number: "INV-000001", date: new Date().toISOString() },
    seller: { name: "Your Company", address: "Address", gstin: "GSTIN" },
    buyer: { name: "Customer", address: "Customer address", gstin: "" },
    lines: [
      { sku: "SKU-1", description: "Sample line", qty: 1, rate: 100, tax: 18, amount: 118 },
    ],
    totals: { subtotal: 100, tax: 18, total: 118 },
  };
}
