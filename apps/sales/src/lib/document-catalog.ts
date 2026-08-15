/**
 * Design-time Document Catalog — Draft → Validate → Publish.
 * Runtime pins published bodies via AssetRef { type: DOCUMENT, id, version }.
 */

import {
  TAX_INVOICE_SEED,
  COMMERCIAL_INVOICE_SEED,
  BILL_OF_SUPPLY_SEED,
  type DocumentDefinition,
} from "@erp/documents";
import { assetKey, type AssetRef } from "@erp/workflow";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

const STARTER_DOCUMENTS: { documentId: string; seed: DocumentDefinition }[] = [
  { documentId: "tax-invoice", seed: TAX_INVOICE_SEED },
  { documentId: "commercial-invoice", seed: COMMERCIAL_INVOICE_SEED },
  { documentId: "bill-of-supply", seed: BILL_OF_SUPPLY_SEED },
];

function seedForDocumentId(documentId: string): DocumentDefinition | null {
  return STARTER_DOCUMENTS.find((d) => d.documentId === documentId)?.seed ?? null;
}

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

/**
 * Force-publish latest starter document bodies for a tenant (archives prior PUBLISHED).
 * Use after seed redesign so Generate picks up chrome without Studio republish.
 */
export async function forcePublishStarterDocuments(
  tenantId: string,
  documentIds: string[] = STARTER_DOCUMENTS.map((d) => d.documentId)
): Promise<{ documentId: string; version: number }[]> {
  const published: { documentId: string; version: number }[] = [];
  for (const documentId of documentIds) {
    const seed = seedForDocumentId(documentId);
    if (!seed) throw new Error(`Unknown starter document: ${documentId}`);

    const max = await prisma.documentTemplateVersion.findFirst({
      where: { tenantId, documentId },
      orderBy: { version: "desc" },
    });
    const nextVersion = (max?.version ?? 0) + 1;

    const created = await prisma.documentTemplateVersion.create({
      data: {
        tenantId,
        documentId,
        version: nextVersion,
        lifecycle: "DRAFT",
        name: seed.name,
        documentType: seed.documentType,
        definition: seed as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.documentTemplateVersion.updateMany({
      where: {
        tenantId,
        documentId,
        lifecycle: "PUBLISHED",
        id: { not: created.id },
      },
      data: { lifecycle: "ARCHIVED" },
    });

    await prisma.documentTemplateVersion.update({
      where: { id: created.id },
      data: { lifecycle: "PUBLISHED", publishedAt: new Date() },
    });

    published.push({ documentId, version: nextVersion });
  }
  return published;
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
