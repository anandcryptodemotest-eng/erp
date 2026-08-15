/**
 * Finalize Sales OrderDocument rows from task/Work Item payload attachments.
 * Upload bytes already live at Gateway; this persists Sales metadata as SoT.
 */
import { prisma } from "@/lib/prisma";

export type AttachmentRef = {
  id?: string;
  name?: string;
  fileName?: string;
  url?: string;
  fileUrl?: string;
  mimeType?: string;
  type?: string;
};

function asAttachmentList(payload: unknown): AttachmentRef[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  const raw = p.attachments;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object") as AttachmentRef[];
}

export async function finalizeOrderDocumentsFromPayload(input: {
  tenantId: string;
  salesOrderId: string;
  uploadedBy: string;
  payload: unknown;
  /** DELIVERY_PROOF when completing delivery; else OTHER */
  defaultType?: string;
}): Promise<number> {
  const list = asAttachmentList(input.payload);
  if (list.length === 0) return 0;

  const existing = await prisma.orderDocument.findMany({
    where: { tenantId: input.tenantId, salesOrderId: input.salesOrderId },
    select: { fileUrl: true },
  });
  const existingUrls = new Set(existing.map((d) => d.fileUrl));

  let created = 0;
  for (const att of list) {
    const fileUrl = String(att.url ?? att.fileUrl ?? "").trim();
    if (!fileUrl || existingUrls.has(fileUrl)) continue;
    const fileName = String(att.name ?? att.fileName ?? "attachment").slice(0, 255);
    const type = String(att.type ?? input.defaultType ?? "OTHER");
    await prisma.orderDocument.create({
      data: {
        tenantId: input.tenantId,
        salesOrderId: input.salesOrderId,
        type: type === "DELIVERY_PROOF" ? "DELIVERY_PROOF" : type === "INVOICE" ? "INVOICE" : type === "ACKNOWLEDGEMENT" ? "ACKNOWLEDGEMENT" : "OTHER",
        fileName,
        fileUrl,
        mimeType: att.mimeType ? String(att.mimeType) : null,
        uploadedBy: input.uploadedBy,
      },
    });
    existingUrls.add(fileUrl);
    created += 1;
  }
  return created;
}

/** Persist commentsAppend from complete payload as OrderNote rows. */
export async function finalizeOrderNotesFromPayload(input: {
  tenantId: string;
  salesOrderId: string;
  authorUserId: string;
  authorRole?: string | null;
  sourceStep?: string | null;
  payload: unknown;
}): Promise<number> {
  if (!input.payload || typeof input.payload !== "object") return 0;
  const p = input.payload as Record<string, unknown>;
  const append = p.commentsAppend;
  const bodies: string[] = [];
  if (typeof append === "string" && append.trim()) bodies.push(append.trim());
  if (Array.isArray(p.notes) ) {
    for (const n of p.notes) {
      if (typeof n === "string" && n.trim()) bodies.push(n.trim());
      else if (n && typeof n === "object" && typeof (n as { body?: string }).body === "string") {
        const b = String((n as { body: string }).body).trim();
        if (b) bodies.push(b);
      }
    }
  }
  if (bodies.length === 0) return 0;

  let created = 0;
  for (const body of bodies) {
    await prisma.orderNote.create({
      data: {
        tenantId: input.tenantId,
        salesOrderId: input.salesOrderId,
        body,
        authorUserId: input.authorUserId,
        authorRole: input.authorRole ?? null,
        sourceStep: input.sourceStep ?? null,
      },
    });
    created += 1;
  }
  return created;
}
