import {
  DocumentKind,
  SupplyType,
  TaxRegime,
  TaxScheme,
  TaxTreatment,
  type InvoiceTaxSummary,
  type LineTaxInput,
  type LineTaxResult,
  type TenantTaxProfile,
} from "./types";

export function normalizeRate(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0) return 0;
  if (rate > 1) return rate / 100;
  return rate;
}

export function resolveSupplyType(buyerGstin?: string | null): SupplyType {
  const g = buyerGstin?.trim();
  return g && g.length >= 15 ? SupplyType.B2B : SupplyType.B2C;
}

export function resolveDocumentKind(profile: TenantTaxProfile): DocumentKind {
  if (profile.regime === TaxRegime.None) return DocumentKind.Commercial;
  if (profile.scheme === TaxScheme.Composition) return DocumentKind.BillOfSupply;
  return DocumentKind.TaxInvoice;
}

export function documentTemplateId(kind: DocumentKind): string {
  switch (kind) {
    case DocumentKind.Commercial:
      return "commercial-invoice";
    case DocumentKind.BillOfSupply:
      return "bill-of-supply";
    default:
      return "tax-invoice";
  }
}

export function computeLineTax(
  input: LineTaxInput,
  opts: { sellerState: string; posState: string; profile: TenantTaxProfile }
): LineTaxResult {
  const { profile, sellerState, posState } = opts;
  const taxableValue = Math.max(0, input.taxableValue);

  if (
    profile.regime === TaxRegime.None ||
    profile.scheme === TaxScheme.Composition ||
    input.taxTreatment === TaxTreatment.Exempt ||
    input.taxTreatment === TaxTreatment.ZeroRated
  ) {
    return { taxableValue, taxRate: 0, taxAmount: 0, cgst: 0, sgst: 0, igst: 0 };
  }

  const rate = normalizeRate(input.taxRate);
  const taxAmount = taxableValue * rate;

  if (sellerState && posState && sellerState === posState) {
    const half = taxAmount / 2;
    return { taxableValue, taxRate: rate, taxAmount, cgst: half, sgst: half, igst: 0 };
  }

  return { taxableValue, taxRate: rate, taxAmount, cgst: 0, sgst: 0, igst: taxAmount };
}

export function computeInvoiceTax(
  lines: LineTaxInput[],
  opts: {
    profile: TenantTaxProfile;
    sellerState: string;
    posState: string;
    buyerGstin?: string | null;
    deliveryFee?: number;
  }
): InvoiceTaxSummary {
  const { profile, sellerState, posState, buyerGstin, deliveryFee = 0 } = opts;

  let taxableValue = 0;
  let tax = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  for (const line of lines) {
    const result = computeLineTax(line, { profile, sellerState, posState });
    taxableValue += result.taxableValue;
    tax += result.taxAmount;
    cgst += result.cgst;
    sgst += result.sgst;
    igst += result.igst;
  }

  const total = taxableValue + tax + deliveryFee;

  return {
    taxableValue,
    tax,
    cgst,
    sgst,
    igst,
    total,
    documentKind: resolveDocumentKind(profile),
    supplyType: resolveSupplyType(buyerGstin),
    placeOfSupply: posState,
  };
}

export function isEinvoiceApplicable(opts: {
  profile: TenantTaxProfile;
  supplyType: SupplyType;
  documentKind: DocumentKind;
  total: number;
}): boolean {
  const { profile, supplyType, documentKind, total } = opts;
  if (profile.regime !== TaxRegime.InGst || profile.eInvoiceMode === "OFF") return false;
  if (documentKind !== DocumentKind.TaxInvoice) return false;
  if (supplyType !== SupplyType.B2B) return false;
  return total > 0;
}
