import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getDocumentByRef, publishDocumentVersion, cloneDocumentToDraft } from "@/lib/document-catalog";
import { SAMPLE_DOCUMENT_PAYLOAD, type DocumentDefinition } from "@erp/documents";
import { renderDocumentHtml, renderDocumentPdfBytes } from "@erp/documents/render";
import { serviceClient } from "@erp/config";
import { fetchTenantLogoUrl } from "@/lib/fetch-tenant-tax-profile";

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

/** POST /api/workflow-documents/:id?action=preview|pdf — HTML preview or PDF download */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  if (action !== "preview" && action !== "pdf") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const row = await prisma.documentTemplateVersion.findFirst({ where: { id, tenantId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  let payload = body.payload as Record<string, unknown> | undefined;
  const feed = body.feed as { kind?: string; invoiceId?: string } | undefined;
  if (!payload) {
    if (feed?.kind === "invoice" && feed.invoiceId) {
      const userId = request.headers.get("x-user-id") ?? undefined;
      const invRes = await serviceClient.call<{ data: { payload: Record<string, unknown> } }>(
        "accounting",
        `/api/invoices/${encodeURIComponent(feed.invoiceId)}/document-payload`,
        { method: "GET", tenantId, userId }
      );
      if (invRes.error || !invRes.data?.data?.payload) {
        return NextResponse.json(
          { error: invRes.error || "Invoice payload not found" },
          { status: invRes.status === 404 ? 404 : 400 }
        );
      }
      payload = invRes.data.data.payload;
    } else {
      payload = await samplePayload(tenantId);
    }
  }
  const definition = (body.definition as DocumentDefinition | undefined) ?? (row.definition as unknown as DocumentDefinition);
  if (action === "pdf") {
    const bytes = await renderDocumentPdfBytes(definition, payload);
    const stem = String(definition.name || "document").replace(/[^\w.-]+/g, "-");
    const suffix = feed?.kind === "invoice" ? "live" : "sample";
    return new NextResponse(Uint8Array.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${stem}-${suffix}.pdf"`,
      },
    });
  }
  const html = renderDocumentHtml(definition, payload, {
    interactive: Boolean(body.interactive),
    selectedId: typeof body.selectedId === "string" ? body.selectedId : null,
  });
  return NextResponse.json({ data: { html } });
}

async function samplePayload(tenantId: string): Promise<Record<string, unknown>> {
  const logoUrl = await fetchTenantLogoUrl(tenantId);
  const sample = structuredClone(SAMPLE_DOCUMENT_PAYLOAD) as Record<string, unknown>;
  const seller = { ...((sample.seller as Record<string, unknown>) ?? {}) };
  if (logoUrl) seller.logoUrl = logoUrl;
  return { ...sample, seller };
}
