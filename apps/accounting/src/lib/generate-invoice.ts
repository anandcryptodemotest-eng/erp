/**
 * Accounting.generateInvoice — domain command.
 * Tenant tax pack drives document kind, tax split, and PDF template.
 */

import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import {
  invoicePdfPath,
  renderDocument,
} from "@erp/documents/render";
import {
  TAX_INVOICE_SEED,
  COMMERCIAL_INVOICE_SEED,
  BILL_OF_SUPPLY_SEED,
  applyPayloadOverrides,
  type DocumentDefinition,
  type PayloadOverride,
} from "@erp/documents";
import { serviceClient } from "@erp/config";
import { assetKey } from "@erp/workflow";
import {
  TaxTreatment,
  TaxRegime,
  EInvoiceMode,
  EinvoiceStatus,
  computeLineTax,
  computeInvoiceTax,
  documentTemplateId,
  isEinvoiceApplicable,
  normalizeRate,
  resolvePlaceOfSupply,
  type TenantTaxProfile,
} from "@erp/tax-india";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { fetchTenantTaxContext } from "@/lib/fetch-tenant-tax-profile";
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
  taxTreatment?: string | null;
  total: number;
  discount?: number | null;
  customSnapshot?: unknown;
};

type SalesOrderPayload = {
  id: string;
  orderNumber: string;
  customerId: string;
  subtotal: number;
  tax: number;
  total: number;
  deliveryFee?: number;
  sourceKind?: string | null;
  placeOfSupply?: string | null;
  customer?: {
    id: string;
    name: string;
    taxId?: string | null;
    stateCode?: string | null;
    address?: string | null;
    city?: string | null;
    paymentTerms?: number | null;
  };
  items: SoItem[];
};

export type GenerateInvoiceInput = {
  tenantId: string;
  userId?: string;
  salesOrderId: string;
  documentRef?: { type: "DOCUMENT"; id: string; version: number };
  issue?: boolean;
  force?: boolean;
  payloadOverrides?: PayloadOverride[];
  formValues?: Record<string, string>;
  payloadBuilder?: string;
};

function lineSnapshot(item: SoItem): Record<string, unknown> {
  return item.customSnapshot && typeof item.customSnapshot === "object"
    ? (item.customSnapshot as Record<string, unknown>)
    : {};
}

function lineHsn(item: SoItem): string | undefined {
  const snap = lineSnapshot(item);
  const hsn =
    (typeof snap.hsnCode === "string" && snap.hsnCode) ||
    (typeof snap.hsn === "string" && snap.hsn) ||
    undefined;
  return hsn;
}

function lineTaxTreatment(item: SoItem): (typeof TaxTreatment)[keyof typeof TaxTreatment] {
  if (item.taxTreatment === TaxTreatment.Exempt) return TaxTreatment.Exempt;
  if (item.taxTreatment === TaxTreatment.ZeroRated) return TaxTreatment.ZeroRated;
  const snap = lineSnapshot(item);
  if (snap.taxTreatment === TaxTreatment.Exempt) return TaxTreatment.Exempt;
  if (snap.taxTreatment === TaxTreatment.ZeroRated) return TaxTreatment.ZeroRated;
  return TaxTreatment.Taxable;
}

async function loadSalesOrder(
  tenantId: string,
  salesOrderId: string,
  userId?: string
): Promise<SalesOrderPayload> {
  const soRes = await serviceClient.call<{ data: SalesOrderPayload }>(
    "sales",
    `/api/orders/${salesOrderId}/invoice-source`,
    { method: "GET", tenantId, userId }
  );
  if (soRes.error || !soRes.data?.data) {
    throw new Error(soRes.error || "Sales order not found");
  }
  return soRes.data.data;
}

function seedForDocumentId(documentId: string): DocumentDefinition {
  if (documentId === "commercial-invoice") return COMMERCIAL_INVOICE_SEED;
  if (documentId === "bill-of-supply") return BILL_OF_SUPPLY_SEED;
  return TAX_INVOICE_SEED;
}

function resolveEinvoiceStatus(
  profile: TenantTaxProfile,
  summary: ReturnType<typeof computeInvoiceTax>
): string {
  if (profile.regime !== TaxRegime.InGst || profile.eInvoiceMode === EInvoiceMode.Off) {
    return EinvoiceStatus.NotApplicable;
  }
  if (
    !isEinvoiceApplicable({
      profile,
      supplyType: summary.supplyType,
      documentKind: summary.documentKind,
      total: summary.total,
    })
  ) {
    return EinvoiceStatus.NotApplicable;
  }
  return EinvoiceStatus.Pending;
}

export async function generateInvoice(input: GenerateInvoiceInput) {
  const { tenantId, userId, salesOrderId } = input;

  const existing = await prisma.invoice.findFirst({
    where: { tenantId, type: "RECEIVABLE", sourceRef: salesOrderId },
    include: { lines: true },
  });
  if (existing?.pdfUrl && !input.force) {
    try {
      await access(invoicePdfPath(tenantId, existing.id));
      return {
        invoice: existing,
        created: false,
        pdfUrl: existing.pdfUrl,
        checksum: existing.pdfChecksum ?? undefined,
      };
    } catch {
      /* re-render */
    }
  }

  const [order, taxCtx] = await Promise.all([
    loadSalesOrder(tenantId, salesOrderId, userId),
    fetchTenantTaxContext(tenantId),
  ]);
  const profile = taxCtx.profile;

  const posResult = resolvePlaceOfSupply({
    transactionPos: order.placeOfSupply,
    shipToStateCode: order.customer?.stateCode,
    buyerGstin: order.customer?.taxId,
    buyerStateCode: order.customer?.stateCode,
    tenantDefaultPos: profile.placeOfSupplyDefault,
  });

  if (profile.regime === TaxRegime.InGst && !posResult.ok) {
    throw new Error(posResult.reason);
  }

  const posState = posResult.ok ? posResult.stateCode : profile.stateCode || "29";
  const sellerState = profile.stateCode || posState;

  const lineInputs = order.items.map((item) => {
    const qty = item.quantity;
    const lineSub = Math.max(0, item.unitPrice * qty - (item.discount ?? 0));
    return {
      item,
      taxableValue: lineSub,
      taxRate: normalizeRate(Number(item.taxRate ?? 0)),
      taxTreatment: lineTaxTreatment(item),
    };
  });

  const summary = computeInvoiceTax(
    lineInputs.map((l) => ({
      taxableValue: l.taxableValue,
      taxRate: l.taxRate,
      taxTreatment: l.taxTreatment,
    })),
    {
      profile,
      sellerState,
      posState,
      buyerGstin: order.customer?.taxId,
      deliveryFee: order.deliveryFee ?? 0,
    }
  );

  const templateId = input.documentRef?.id ?? documentTemplateId(summary.documentKind);
  let documentRef = input.documentRef ?? {
    type: "DOCUMENT" as const,
    id: templateId,
    version: 1,
  };

  const builderType = input.payloadBuilder ?? "accounting.invoice";
  if (!getDocumentPayloadProvider(builderType)) {
    throw new Error(`Unknown payloadBuilder: ${builderType}`);
  }

  // Prefer latest published catalog so force-published seeds apply without
  // bumping every workflow documentRef pin (still stores the resolved version).
  let definition: DocumentDefinition = seedForDocumentId(templateId);
  const latest = await serviceClient.call<{
    data: { definition: DocumentDefinition; ref: { id: string; version: number } };
  }>(
    "sales",
    `/api/workflow-documents/lookup?documentId=${encodeURIComponent(templateId)}`,
    { method: "GET", tenantId, userId }
  );
  if (latest.data?.data?.definition) {
    definition = latest.data.data.definition;
    if (latest.data.data.ref) documentRef = { type: "DOCUMENT", ...latest.data.data.ref };
  } else if (input.documentRef) {
    const pinned = await serviceClient.call<{
      data: { definition: DocumentDefinition; ref: { id: string; version: number } };
    }>(
      "sales",
      `/api/workflow-documents/lookup?documentId=${encodeURIComponent(input.documentRef.id)}&version=${input.documentRef.version}`,
      { method: "GET", tenantId, userId }
    );
    if (pinned.data?.data?.definition) {
      definition = pinned.data.data.definition;
      if (pinned.data.data.ref) documentRef = { type: "DOCUMENT", ...pinned.data.data.ref };
    }
  }

  const today = new Date();
  const due = new Date(today);
  const termsDays = Number(order.customer?.paymentTerms ?? 30);
  due.setDate(due.getDate() + (Number.isFinite(termsDays) && termsDays >= 0 ? termsDays : 30));

  const computedLines = lineInputs.map(({ item, taxableValue, taxRate, taxTreatment }) => {
    const tax = computeLineTax(
      { taxableValue, taxRate, taxTreatment },
      { profile, sellerState, posState }
    );
    const snap = lineSnapshot(item);
    const sku =
      (typeof snap.sku === "string" && snap.sku) ||
      (typeof snap.productSku === "string" && snap.productSku) ||
      undefined;
    return {
      lineNo: 0,
      productId: item.productId,
      sku,
      description: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: tax.taxRate,
      taxAmount: tax.taxAmount,
      lineTotal: taxableValue + tax.taxAmount,
      hsn: lineHsn(item),
      attributes: {
        ...snap,
        taxTreatment,
        hsn: lineHsn(item),
        taxableValue: tax.taxableValue,
        cgst: tax.cgst,
        sgst: tax.sgst,
        igst: tax.igst,
      } as Prisma.InputJsonValue,
    };
  });

  const einvoiceStatus = resolveEinvoiceStatus(profile, summary);
  const blockIssue =
    profile.eInvoiceMode === EInvoiceMode.Required &&
    einvoiceStatus === EinvoiceStatus.Pending;

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
          sourceKind: order.sourceKind ?? "SALES_ORDER",
          date: today,
          dueDate: due,
          subtotal: summary.taxableValue,
          tax: summary.tax,
          total: summary.total,
          taxableValue: summary.taxableValue,
          cgst: summary.cgst,
          sgst: summary.sgst,
          igst: summary.igst,
          documentKind: summary.documentKind,
          supplyType: summary.supplyType,
          placeOfSupply: posState,
          buyerGstin: order.customer?.taxId?.trim().toUpperCase() || null,
          einvoiceStatus,
          status: input.issue === false || blockIssue ? "DRAFT" : "ISSUED",
          notes: `Generated from SO ${order.orderNumber}`,
          documentRef: assetKey(documentRef),
          lines: {
            create: computedLines.map((l, idx) => ({
              ...l,
              lineNo: idx + 1,
            })),
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
  } else if (input.force) {
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } });
    invoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        subtotal: summary.taxableValue,
        tax: summary.tax,
        total: summary.total,
        taxableValue: summary.taxableValue,
        cgst: summary.cgst,
        sgst: summary.sgst,
        igst: summary.igst,
        documentKind: summary.documentKind,
        supplyType: summary.supplyType,
        placeOfSupply: posState,
        buyerGstin: order.customer?.taxId?.trim().toUpperCase() || null,
        einvoiceStatus,
        lines: {
          create: computedLines.map((l, idx) => ({ ...l, lineNo: idx + 1 })),
        },
      },
      include: { lines: true },
    });
  }

  if (!invoice) throw new Error("Failed to create invoice");

  const payload = buildInvoicePayload(invoice, order, profile, summary, taxCtx.logoUrl);
  const overrideErrors = applyPayloadOverrides(
    payload,
    input.payloadOverrides,
    input.formValues,
    "INVOICE"
  );
  if (overrideErrors.length) throw new Error(overrideErrors.join("; "));

  const outputPath = invoicePdfPath(tenantId, invoice.id);
  const publicUrl = `/api/invoices/${invoice.id}/pdf`;
  const rendered = await renderDocument({
    assetRef: documentRef,
    definition,
    payload,
    outputPath,
    publicUrl,
  });

  const nextStatus =
    input.issue === false || blockIssue
      ? invoice.status
      : invoice.status === "DRAFT"
        ? "ISSUED"
        : invoice.status;

  invoice = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      pdfUrl: rendered.pdfUrl,
      pdfChecksum: rendered.checksum,
      documentRef: assetKey(documentRef),
      status: nextStatus,
    },
    include: { lines: true },
  });

  await serviceClient
    .call("sales", `/api/orders/${salesOrderId}?action=upload-document`, {
      method: "PATCH",
      tenantId,
      userId,
      body: {
        type: "INVOICE",
        fileName: `${invoice.number}.pdf`,
        fileUrl: rendered.pdfUrl,
        mimeType: "application/pdf",
      },
    })
    .catch(() => undefined);

  return {
    invoice,
    created,
    pdfUrl: rendered.pdfUrl,
    checksum: rendered.checksum,
    requiresIrn: blockIssue,
  };
}

function partyStateLine(stateCode?: string | null): string {
  const code = (stateCode ?? "").trim();
  return code ? `State: ${code}` : "";
}

function partyGstinLine(gstin?: string | null): string {
  const g = (gstin ?? "").trim();
  return g ? `GSTIN: ${g}` : "";
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
    documentKind?: string | null;
    placeOfSupply?: string | null;
    notes?: string | null;
    cgst?: number;
    sgst?: number;
    igst?: number;
    lines?: {
      sku: string | null;
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate?: number;
      taxAmount: number;
      lineTotal: number;
      hsn?: string | null;
      attributes?: unknown;
    }[];
  },
  order: SalesOrderPayload,
  profile?: TenantTaxProfile,
  summary?: ReturnType<typeof computeInvoiceTax>,
  logoUrl?: string
): Record<string, unknown> {
  const title =
    invoice.documentKind === "COMMERCIAL"
      ? "BILL"
      : invoice.documentKind === "BILL_OF_SUPPLY"
        ? "BILL OF SUPPLY"
        : "TAX INVOICE";

  const sellerName = profile?.legalName || process.env.TENANT_LEGAL_NAME || "Seller";
  const sellerGstin = profile?.regime === "IN_GST" ? profile.gstin ?? "" : "";
  const sellerState = profile?.stateCode ?? "";
  const sellerAddress = profile?.address || process.env.TENANT_ADDRESS || "";
  const buyerGstin = order.customer?.taxId ?? "";
  const buyerState = order.customer?.stateCode ?? "";
  const placeOfSupply = invoice.placeOfSupply ?? summary?.placeOfSupply ?? "";

  const gstinMetaParts = [
    sellerGstin ? `GSTIN: ${sellerGstin}` : "",
    sellerState ? `State: ${sellerState}` : "",
  ].filter(Boolean);

  return {
    invoice: {
      number: invoice.number,
      date: invoice.date.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      title,
      notes: (invoice.notes ?? "").trim(),
      placeOfSupply,
      placeOfSupplyLabel: placeOfSupply ? `Place of Supply: ${placeOfSupply}` : "",
    },
    seller: {
      name: sellerName,
      address: sellerAddress,
      gstin: sellerGstin,
      logoUrl: (logoUrl && logoUrl.trim()) || process.env.TENANT_LOGO_URL || "",
      stateCode: sellerState,
      state: sellerState,
      gstinMeta: gstinMetaParts.join(" | "),
      cityState: sellerState ? `State ${sellerState}` : "",
      gstinLine: partyGstinLine(sellerGstin),
      stateLine: partyStateLine(sellerState),
      signatoryFor: `For ${sellerName}`,
    },
    buyer: {
      name: order.customer?.name ?? invoice.entityName ?? "",
      address: [order.customer?.address, order.customer?.city].filter(Boolean).join(", "),
      gstin: buyerGstin,
      stateCode: buyerState,
      state: buyerState,
      gstinLine: partyGstinLine(buyerGstin),
      stateLine: partyStateLine(buyerState),
    },
    tax: {
      placeOfSupply,
      cgst: invoice.cgst ?? summary?.cgst ?? 0,
      sgst: invoice.sgst ?? summary?.sgst ?? 0,
      igst: invoice.igst ?? summary?.igst ?? 0,
    },
    lines: (invoice.lines ?? []).map((l) => {
      const attrs =
        l.attributes && typeof l.attributes === "object"
          ? (l.attributes as Record<string, unknown>)
          : {};
      return {
        sku: l.sku ?? "",
        description: l.description,
        hsn: l.hsn ?? (typeof attrs.hsn === "string" ? attrs.hsn : ""),
        qty: l.quantity,
        rate: l.unitPrice,
        taxRate: l.taxRate != null ? `${(normalizeRate(l.taxRate) * 100).toFixed(2)}%` : "",
        tax: l.taxAmount,
        amount: l.lineTotal,
      };
    }),
    totals: {
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
    },
    meta: { checksumSeed: createHash("sha256").update(invoice.number).digest("hex").slice(0, 8) },
  };
}

function stubOrderFromInvoice(invoice: {
  id: string;
  sourceRef: string | null;
  entityId: string | null;
  entityName: string | null;
  subtotal: number;
  tax: number;
  total: number;
}): SalesOrderPayload {
  return {
    id: invoice.sourceRef ?? invoice.id,
    orderNumber: "",
    customerId: invoice.entityId ?? "",
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    customer: {
      id: invoice.entityId ?? "",
      name: invoice.entityName ?? "",
    },
    items: [],
  };
}

/** Same payload generate uses — Studio invoice simulate and payloadBuilder. */
export async function buildInvoiceDocumentPayload(
  tenantId: string,
  invoiceId: string,
  userId?: string
): Promise<Record<string, unknown>> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { lines: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  const taxCtx = await fetchTenantTaxContext(tenantId);
  let order = stubOrderFromInvoice(invoice);
  if (invoice.sourceRef) {
    try {
      order = await loadSalesOrder(tenantId, invoice.sourceRef, userId);
    } catch {
      /* Quick Bill / missing SO — keep invoice lines + entity name */
    }
  }
  return buildInvoicePayload(invoice, order, taxCtx.profile, undefined, taxCtx.logoUrl);
}

registerDocumentPayloadProvider({
  type: "accounting.invoice",
  async build(ctx: PayloadBuildContext): Promise<Record<string, unknown>> {
    if (ctx.entityId) {
      return buildInvoiceDocumentPayload(ctx.tenantId, ctx.entityId, ctx.userId);
    }
    if (!ctx.salesOrderId) throw new Error("salesOrderId or entityId required");
    const invoice = await prisma.invoice.findFirst({
      where: { tenantId: ctx.tenantId, sourceRef: ctx.salesOrderId },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });
    if (!invoice) throw new Error("Invoice not found for sales order — generate first");
    return buildInvoiceDocumentPayload(ctx.tenantId, invoice.id, ctx.userId);
  },
});
