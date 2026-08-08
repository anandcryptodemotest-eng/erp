/**
 * Accounting.generateInvoice — domain command.
 * Create AR + lines, build payload, renderDocument, persist pdfUrl.
 */

import { createHash } from "node:crypto";
import {
  invoicePdfPath,
  renderDocument,
} from "@erp/documents/render";
import {
  TAX_INVOICE_SEED,
  applyPayloadOverrides,
  type DocumentDefinition,
  type PayloadOverride,
} from "@erp/documents";
import { serviceClient } from "@erp/config";
import { assetKey } from "@erp/workflow";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import {
  registerDocumentPayloadProvider,
  getDocumentPayloadProvider,
  type PayloadBuildContext,
} from "@/lib/document-payload-provider";

type SoItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number | null;
  taxAmount?: number | null;
  total: number;
  customSnapshot?: unknown;
};

type SalesOrderPayload = {
  id: string;
  orderNumber: string;
  customerId: string;
  subtotal: number;
  tax: number;
  total: number;
  customer?: {
    id: string;
    name: string;
    taxId?: string | null;
    address?: string | null;
    city?: string | null;
  };
  items: SoItem[];
};

export type GenerateInvoiceInput = {
  tenantId: string;
  userId?: string;
  salesOrderId: string;
  documentRef?: { type: "DOCUMENT"; id: string; version: number };
  issue?: boolean;
  /** Re-render PDF even when one already exists (widget Regenerate). */
  force?: boolean;
  /** Exceptional form → payload path overlays (schema-validated). */
  payloadOverrides?: PayloadOverride[];
  formValues?: Record<string, string>;
  payloadBuilder?: string;
};

async function loadSalesOrder(
  tenantId: string,
  salesOrderId: string,
  userId?: string
): Promise<SalesOrderPayload> {
  const soRes = await serviceClient.call<{ data: SalesOrderPayload }>(
    "sales",
    `/api/orders/${salesOrderId}`,
    { method: "GET", tenantId, userId }
  );
  if (soRes.error || !soRes.data?.data) {
    throw new Error(soRes.error || "Sales order not found");
  }
  return soRes.data.data;
}

export async function generateInvoice(input: GenerateInvoiceInput) {
  const { tenantId, userId, salesOrderId } = input;
  let documentRef = input.documentRef ?? {
    type: "DOCUMENT" as const,
    id: "tax-invoice",
    version: 1,
  };

  const existing = await prisma.invoice.findFirst({
    where: { tenantId, type: "RECEIVABLE", sourceRef: salesOrderId },
    include: { lines: true },
  });
  if (existing?.pdfUrl && !input.force) {
    return {
      invoice: existing,
      created: false,
      pdfUrl: existing.pdfUrl,
      checksum: existing.pdfChecksum ?? undefined,
    };
  }

  const order = await loadSalesOrder(tenantId, salesOrderId, userId);

  const builderType = input.payloadBuilder ?? "accounting.invoice";
  if (!getDocumentPayloadProvider(builderType)) {
    throw new Error(`Unknown payloadBuilder: ${builderType}`);
  }

  let definition: DocumentDefinition = TAX_INVOICE_SEED;
  const docRes = await serviceClient.call<{
    data: { definition: DocumentDefinition; ref: { id: string; version: number } };
  }>(
    "sales",
    `/api/workflow-documents/lookup?documentId=${encodeURIComponent(documentRef.id)}&version=${documentRef.version}`,
    { method: "GET", tenantId, userId }
  );
  if (docRes.status === 404 || !docRes.data?.data?.definition) {
    const latest = await serviceClient.call<{
      data: { definition: DocumentDefinition; ref: { id: string; version: number } };
    }>(
      "sales",
      `/api/workflow-documents/lookup?documentId=${encodeURIComponent(documentRef.id)}`,
      { method: "GET", tenantId, userId }
    );
    if (latest.data?.data?.definition) {
      definition = latest.data.data.definition;
      if (latest.data.data.ref) {
        documentRef = {
          type: "DOCUMENT",
          id: latest.data.data.ref.id,
          version: latest.data.data.ref.version,
        };
      }
    }
  } else {
    definition = docRes.data.data.definition;
  }

  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);

  let invoice = existing;
  let created = false;
  if (!invoice) {
    const count = await prisma.invoice.count({ where: { tenantId, type: "RECEIVABLE" } });
    const number = `INV-${String(count + 1).padStart(6, "0")}`;
    try {
      invoice = await prisma.invoice.create({
        data: {
          tenantId,
          number,
          type: "RECEIVABLE",
          entityId: order.customerId,
          entityName: order.customer?.name ?? undefined,
          sourceRef: salesOrderId,
          date: today,
          dueDate: due,
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          status: input.issue === false ? "DRAFT" : "ISSUED",
          notes: `Generated from SO ${order.orderNumber}`,
          documentRef: assetKey(documentRef),
          lines: {
            create: order.items.map((item, idx) => {
              const taxRate = Number(item.taxRate ?? 0);
              const lineSub = item.unitPrice * item.quantity;
              const taxAmount = Number(
                item.taxAmount ?? (taxRate > 0 ? (lineSub * taxRate) / 100 : 0)
              );
              const snap =
                item.customSnapshot && typeof item.customSnapshot === "object"
                  ? (item.customSnapshot as Record<string, unknown>)
                  : null;
              const sku =
                (typeof snap?.sku === "string" && snap.sku) ||
                (typeof snap?.productSku === "string" && snap.productSku) ||
                undefined;
              return {
                lineNo: idx + 1,
                productId: item.productId,
                sku,
                description: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate,
                taxAmount,
                lineTotal: item.total,
                attributes: (snap ?? undefined) as Prisma.InputJsonValue | undefined,
              };
            }),
          },
        },
        include: { lines: true },
      });
      created = true;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) {
        throw error;
      }
      invoice = await prisma.invoice.findFirst({
        where: { tenantId, type: "RECEIVABLE", sourceRef: salesOrderId },
        include: { lines: true },
      });
    }
  }
  if (!invoice) throw new Error("Failed to create invoice");

  const payload = buildInvoicePayload(invoice, order);
  const overrideErrors = applyPayloadOverrides(
    payload,
    input.payloadOverrides,
    input.formValues,
    "INVOICE"
  );
  if (overrideErrors.length) {
    throw new Error(overrideErrors.join("; "));
  }
  const outputPath = invoicePdfPath(tenantId, invoice.id);
  const publicUrl = `/api/invoices/${invoice.id}/pdf`;
  const rendered = await renderDocument({
    assetRef: documentRef,
    definition,
    payload,
    outputPath,
    publicUrl,
  });

  invoice = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      pdfUrl: rendered.pdfUrl,
      pdfChecksum: rendered.checksum,
      documentRef: assetKey(documentRef),
      status: input.issue === false ? invoice.status : invoice.status === "DRAFT" ? "ISSUED" : invoice.status,
    },
    include: { lines: true },
  });

  // Best-effort OrderDocument on sales
  await serviceClient.call("sales", `/api/orders/${salesOrderId}?action=upload-document`, {
    method: "PATCH",
    tenantId,
    userId,
    body: {
      type: "INVOICE",
      fileName: `${invoice.number}.pdf`,
      fileUrl: rendered.pdfUrl,
      mimeType: "application/pdf",
    },
  }).catch(() => undefined);

  return { invoice, created, pdfUrl: rendered.pdfUrl, checksum: rendered.checksum };
}

export function buildInvoicePayload(
  invoice: {
    number: string;
    date: Date;
    dueDate: Date;
    subtotal: number;
    tax: number;
    total: number;
    entityName: string | null;
    lines?: {
      sku: string | null;
      description: string;
      quantity: number;
      unitPrice: number;
      taxAmount: number;
      lineTotal: number;
    }[];
  },
  order: SalesOrderPayload
): Record<string, unknown> {
  return {
    invoice: {
      number: invoice.number,
      date: invoice.date.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
    },
    seller: {
      name: process.env.TENANT_LEGAL_NAME || "Seller",
      address: process.env.TENANT_ADDRESS || "",
      gstin: process.env.TENANT_GSTIN || "",
      logoUrl: process.env.TENANT_LOGO_URL || "",
    },
    buyer: {
      name: order.customer?.name ?? invoice.entityName ?? "",
      address: [order.customer?.address, order.customer?.city].filter(Boolean).join(", "),
      gstin: order.customer?.taxId ?? "",
    },
    lines: (invoice.lines ?? []).map((l) => ({
      sku: l.sku ?? "",
      description: l.description,
      qty: l.quantity,
      rate: l.unitPrice,
      tax: l.taxAmount,
      amount: l.lineTotal,
    })),
    totals: {
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
    },
    meta: { checksumSeed: createHash("sha256").update(invoice.number).digest("hex").slice(0, 8) },
  };
}

/**
 * DocumentPayloadProvider for Form widgets with payloadBuilder: "accounting.invoice".
 * Builds the Document Payload from domain entities — never from form field names.
 */
registerDocumentPayloadProvider({
  type: "accounting.invoice",
  async build(ctx: PayloadBuildContext): Promise<Record<string, unknown>> {
    if (!ctx.salesOrderId) throw new Error("salesOrderId required");
    const invoice = await prisma.invoice.findFirst({
      where: { tenantId: ctx.tenantId, sourceRef: ctx.salesOrderId },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });
    if (!invoice) throw new Error("Invoice not found for sales order — generate first");
    const order = await loadSalesOrder(ctx.tenantId, ctx.salesOrderId, ctx.userId);
    return buildInvoicePayload(invoice, order);
  },
});
