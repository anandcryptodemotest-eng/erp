/**
 * NIC e-invoice integration — sandbox stub.
 * Phase B: replace with real NIC IRP calls.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  EInvoiceMode,
  EinvoiceStatus,
  TaxRegime,
  isEinvoiceApplicable,
} from "@erp/tax-india";
import { fetchTenantTaxProfile } from "@/lib/fetch-tenant-tax-profile";

export type GenerateIrnResult =
  | { ok: true; irn: string; ackNo: string; ackDate: Date; signedQr: string }
  | { ok: false; error: string };

export async function generateIrnForInvoice(
  tenantId: string,
  invoiceId: string
): Promise<GenerateIrnResult> {
  const [invoice, profile] = await Promise.all([
    prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } }),
    fetchTenantTaxProfile(tenantId),
  ]);

  if (!invoice) return { ok: false, error: "Invoice not found" };
  if (profile.regime !== TaxRegime.InGst) {
    return { ok: false, error: "E-invoice not applicable for non-GST tenant" };
  }
  if (profile.eInvoiceMode === EInvoiceMode.Off) {
    return { ok: false, error: "E-invoice mode is OFF" };
  }
  if (invoice.einvoiceStatus === EinvoiceStatus.Success && invoice.irn) {
    return {
      ok: true,
      irn: invoice.irn,
      ackNo: invoice.ackNo ?? "",
      ackDate: invoice.ackDate ?? new Date(),
      signedQr: invoice.signedQr ?? "",
    };
  }

  const applicable = isEinvoiceApplicable({
    profile,
    supplyType: (invoice.supplyType as "B2B" | "B2C") ?? "B2C",
    documentKind: invoice.documentKind as "TAX_INVOICE" | "COMMERCIAL" | "BILL_OF_SUPPLY",
    total: invoice.total,
  });
  if (!applicable) {
    return { ok: false, error: "E-invoice not applicable for this bill" };
  }

  // DEMO (default): stub IRN. PRODUCTION: real NIC IRP (credentials required — not wired yet).
  if (profile.nicMode === "PRODUCTION") {
    return {
      ok: false,
      error:
        "Production NIC/IRP is not enabled yet. Keep tax.nic.mode=DEMO for stub IRN, or wait for live credentials wiring.",
    };
  }

  const seed = createHash("sha256").update(`${tenantId}:${invoice.id}:${invoice.number}`).digest("hex");
  const irn = `SANDBOX-${seed.slice(0, 32).toUpperCase()}`;
  const ackNo = `ACK${seed.slice(0, 12).toUpperCase()}`;
  const ackDate = new Date();
  const signedQr = JSON.stringify({
    Irn: irn,
    AckNo: ackNo,
    AckDt: ackDate.toISOString(),
    mode: "DEMO",
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      irn,
      ackNo,
      ackDate,
      signedQr,
      einvoiceStatus: EinvoiceStatus.Success,
      status: invoice.status === "DRAFT" ? "ISSUED" : invoice.status,
    },
  });

  return { ok: true, irn, ackNo, ackDate, signedQr };
}

export async function cancelIrnForInvoice(
  tenantId: string,
  invoiceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice?.irn) return { ok: false, error: "No IRN to cancel" };

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      einvoiceStatus: EinvoiceStatus.Cancelled,
      irn: null,
      ackNo: null,
      ackDate: null,
      signedQr: null,
    },
  });

  return { ok: true };
}
