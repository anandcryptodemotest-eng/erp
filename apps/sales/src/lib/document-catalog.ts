/**
 * Design-time Document Catalog — Draft → Validate → Publish.
 * Runtime pins published bodies via AssetRef { type: DOCUMENT, id, version }.
 */

import { TAX_INVOICE_SEED, type DocumentDefinition } from "@erp/documents";
import { assetKey, type AssetRef } from "@erp/workflow";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

export async function ensureDocumentCatalogSeed(
  tenantId: string,
  opts: { force?: boolean } = {}
) {
  if (!opts.force) return;
  const existing = await prisma.documentTemplateVersion.findFirst({
    where: { tenantId, documentId: "tax-invoice" },
  });
  if (existing) return;
  await prisma.documentTemplateVersion.create({
    data: {
      tenantId,
      documentId: "tax-invoice",
      version: 1,
      lifecycle: "PUBLISHED",
      name: TAX_INVOICE_SEED.name,
      documentType: TAX_INVOICE_SEED.documentType,
      definition: TAX_INVOICE_SEED as unknown as Prisma.InputJsonValue,
      publishedAt: new Date(),
    },
  });
}

export async function listDocumentVersions(
  tenantId: string,
  opts: { documentId?: string; lifecycle?: string; documentType?: string } = {}
) {
  return prisma.documentTemplateVersion.findMany({
    where: {
      tenantId,
      ...(opts.documentId ? { documentId: opts.documentId } : {}),
      ...(opts.lifecycle ? { lifecycle: opts.lifecycle } : {}),
      ...(opts.documentType ? { documentType: opts.documentType } : {}),
    },
    orderBy: [{ documentId: "asc" }, { version: "desc" }],
  });
}

export async function getPublishedDocument(
  tenantId: string,
  documentId: string
): Promise<{ ref: AssetRef; definition: DocumentDefinition; recordId: string } | null> {
  const row = await prisma.documentTemplateVersion.findFirst({
    where: { tenantId, documentId, lifecycle: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
  if (!row) return null;
  return {
    ref: { type: "DOCUMENT", id: row.documentId, version: row.version },
    definition: row.definition as unknown as DocumentDefinition,
    recordId: row.id,
  };
}

export async function getDocumentByRef(
  tenantId: string,
  ref: { id: string; version: number }
): Promise<{ ref: AssetRef; definition: DocumentDefinition } | null> {
  const row = await prisma.documentTemplateVersion.findFirst({
    where: {
      tenantId,
      documentId: ref.id,
      version: ref.version,
      lifecycle: "PUBLISHED",
    },
  });
  if (!row) return null;
  return {
    ref: { type: "DOCUMENT", id: row.documentId, version: row.version },
    definition: row.definition as unknown as DocumentDefinition,
  };
}

export async function publishDocumentVersion(tenantId: string, recordId: string) {
  const row = await prisma.documentTemplateVersion.findFirst({
    where: { id: recordId, tenantId },
  });
  if (!row) throw new Error("Document version not found");
  if (row.lifecycle === "PUBLISHED") return row;
  return prisma.documentTemplateVersion.update({
    where: { id: recordId },
    data: { lifecycle: "PUBLISHED", publishedAt: new Date() },
  });
}

/**
 * Same-tenant revise: new version of the same documentId as DRAFT.
 * Separate from cross-tenant Assign (`cloneDocumentToTenant`).
 */
export async function cloneDocumentToDraft(tenantId: string, recordId: string) {
  const source = await prisma.documentTemplateVersion.findFirst({
    where: { id: recordId, tenantId },
  });
  if (!source) throw new Error("Document version not found");

  const latest = await prisma.documentTemplateVersion.findFirst({
    where: { tenantId, documentId: source.documentId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  return prisma.documentTemplateVersion.create({
    data: {
      tenantId,
      documentId: source.documentId,
      version: nextVersion,
      lifecycle: "DRAFT",
      name: source.name,
      documentType: source.documentType,
      definition: source.definition as Prisma.InputJsonValue,
      clonedFromId: source.id,
      publishedAt: null,
    },
  });
}

/** Platform assign: clone published source into target tenant as Draft (or publish copy). */
export async function cloneDocumentToTenant(opts: {
  sourceTenantId: string;
  sourceDocumentId: string;
  sourceVersion?: number;
  targetTenantId: string;
  publish?: boolean;
}) {
  const source = opts.sourceVersion
    ? await prisma.documentTemplateVersion.findFirst({
        where: {
          tenantId: opts.sourceTenantId,
          documentId: opts.sourceDocumentId,
          version: opts.sourceVersion,
        },
      })
    : await prisma.documentTemplateVersion.findFirst({
        where: {
          tenantId: opts.sourceTenantId,
          documentId: opts.sourceDocumentId,
          lifecycle: "PUBLISHED",
        },
        orderBy: { version: "desc" },
      });
  if (!source) throw new Error("Source document not found");

  const latest = await prisma.documentTemplateVersion.findFirst({
    where: { tenantId: opts.targetTenantId, documentId: source.documentId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? 0) + 1;
  const publish = opts.publish ?? false;
  return prisma.documentTemplateVersion.create({
    data: {
      tenantId: opts.targetTenantId,
      documentId: source.documentId,
      version: nextVersion,
      lifecycle: publish ? "PUBLISHED" : "DRAFT",
      name: source.name,
      documentType: source.documentType,
      definition: source.definition as Prisma.InputJsonValue,
      clonedFromId: source.id,
      publishedAt: publish ? new Date() : null,
    },
  });
}

export function documentAssetKey(ref: AssetRef): string {
  return assetKey(ref);
}
