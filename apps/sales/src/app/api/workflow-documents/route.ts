import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  cloneDocumentToTenant,
  ensureDocumentCatalogSeed,
  listDocumentVersions,
} from "@/lib/document-catalog";
import { blankDocumentDefinition, type DocumentDefinition } from "@erp/documents";
import { getServiceSecret } from "@erp/auth";

const log = createLogger({ service: "sales" });

function isTrustedService(request: Request): boolean {
  const serviceKey = request.headers.get("x-service-key");
  const expectedSecret = getServiceSecret();
  return Boolean(serviceKey && serviceKey === expectedSecret);
}

/** GET /api/workflow-documents */
export async function GET(request: Request) {
  try {
    const tenantId = request.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

    const url = new URL(request.url);
    const documentId = url.searchParams.get("documentId") ?? undefined;
    const lifecycle = url.searchParams.get("lifecycle") ?? undefined;
    const documentType = url.searchParams.get("documentType") ?? undefined;

    const rows = await listDocumentVersions(tenantId, { documentId, lifecycle, documentType });
    return NextResponse.json({ data: rows });
  } catch (e: unknown) {
    log.error("workflow_documents_get", { err: e });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load documents" },
      { status: 500 }
    );
  }
}

/** POST /api/workflow-documents — create draft, seed, or clone/assign */
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const action = body.action as string | undefined;
    const serviceOk = isTrustedService(request);
    const serviceBypass =
      serviceOk && (action === "seed" || action === "clone" || action === "assign");

    if (!serviceBypass) {
      const { requireProcessDesignerFromRequest } = await import("@erp/auth");
      const gate = await requireProcessDesignerFromRequest(request);
      if (gate instanceof Response) return gate;
    }

    if (action === "seed") {
      await ensureDocumentCatalogSeed(tenantId, { force: true });
      const rows = await listDocumentVersions(tenantId);
      return NextResponse.json({ data: rows, meta: { seeded: true } });
    }

    if (action === "clone" || action === "assign") {
      const sourceTenantId = String(body.sourceTenantId ?? tenantId);
      const targetTenantId = String(body.targetTenantId ?? tenantId);
      const sourceDocumentId = String(body.documentId ?? body.sourceDocumentId ?? "");
      if (!sourceDocumentId) {
        return NextResponse.json({ error: "documentId required" }, { status: 400 });
      }
      const cloned = await cloneDocumentToTenant({
        sourceTenantId,
        sourceDocumentId,
        sourceVersion: body.sourceVersion != null ? Number(body.sourceVersion) : undefined,
        targetTenantId,
        publish: Boolean(body.publish),
      });
      return NextResponse.json({ data: cloned }, { status: 201 });
    }

    const documentId = String(body.documentId ?? `doc-${Date.now().toString(36)}`);
    const definition = (body.definition as DocumentDefinition) ??
      blankDocumentDefinition({
        id: documentId,
        name: body.name,
        documentType: body.documentType,
      });
    const latest = await prisma.documentTemplateVersion.findFirst({
      where: { tenantId, documentId },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;
    const row = await prisma.documentTemplateVersion.create({
      data: {
        tenantId,
        documentId,
        version,
        lifecycle: "DRAFT",
        name: body.name ?? definition.name,
        documentType: body.documentType ?? definition.documentType ?? "INVOICE",
        definition: definition as unknown as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e: unknown) {
    log.error("workflow_documents_post", { err: e });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create document" },
      { status: 500 }
    );
  }
}
