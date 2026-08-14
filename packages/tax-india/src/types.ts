export const TaxRegime = {
  None: "NONE",
  InGst: "IN_GST",
} as const;
export type TaxRegime = (typeof TaxRegime)[keyof typeof TaxRegime];

export const TaxScheme = {
  Unregistered: "UNREGISTERED",
  Regular: "REGULAR",
  Composition: "COMPOSITION",
} as const;
export type TaxScheme = (typeof TaxScheme)[keyof typeof TaxScheme];

export const EInvoiceMode = {
  Off: "OFF",
  Optional: "OPTIONAL",
  Required: "REQUIRED",
} as const;
export type EInvoiceMode = (typeof EInvoiceMode)[keyof typeof EInvoiceMode];

export const DocumentKind = {
  Commercial: "COMMERCIAL",
  TaxInvoice: "TAX_INVOICE",
  BillOfSupply: "BILL_OF_SUPPLY",
} as const;
export type DocumentKind = (typeof DocumentKind)[keyof typeof DocumentKind];

export const SupplyType = {
  B2B: "B2B",
  B2C: "B2C",
} as const;
export type SupplyType = (typeof SupplyType)[keyof typeof SupplyType];

export const TaxTreatment = {
  Taxable: "TAXABLE",
  Exempt: "EXEMPT",
  ZeroRated: "ZERO_RATED",
} as const;
export type TaxTreatment = (typeof TaxTreatment)[keyof typeof TaxTreatment];

export const EinvoiceStatus = {
  NotApplicable: "NOT_APPLICABLE",
  Pending: "PENDING",
  Success: "SUCCESS",
  Failed: "FAILED",
  Cancelled: "CANCELLED",
} as const;
export type EinvoiceStatus = (typeof EinvoiceStatus)[keyof typeof EinvoiceStatus];

export const EwayStatus = {
  NotApplicable: "NOT_APPLICABLE",
  Pending: "PENDING",
  Success: "SUCCESS",
  Failed: "FAILED",
  Cancelled: "CANCELLED",
} as const;
export type EwayStatus = (typeof EwayStatus)[keyof typeof EwayStatus];

export const SourceKind = {
  SalesOrder: "SALES_ORDER",
  QuickBill: "QUICK_BILL",
} as const;
export type SourceKind = (typeof SourceKind)[keyof typeof SourceKind];

export const TaxSettingKey = {
  Regime: "tax.regime",
  Scheme: "tax.scheme",
  Gstin: "tax.gstin",
  LegalName: "tax.legalName",
  Address: "tax.address",
  StateCode: "tax.stateCode",
  PlaceOfSupplyDefault: "tax.placeOfSupplyDefault",
  EInvoiceMode: "tax.eInvoiceMode",
  LutNumber: "tax.lutNumber",
  NicClientId: "tax.nic.clientId",
  NicClientSecret: "tax.nic.clientSecret",
  NicSandbox: "tax.nic.sandbox",
  /** DEMO = stub IRN/e-way (no real NIC). PRODUCTION = live IRP (needs credentials). */
  NicMode: "tax.nic.mode",
} as const;

export type TenantTaxProfile = {
  regime: TaxRegime;
  scheme: TaxScheme;
  gstin: string;
  legalName: string;
  address: string;
  stateCode: string;
  placeOfSupplyDefault: string;
  eInvoiceMode: EInvoiceMode;
  lutNumber?: string;
  /** DEMO keeps stub IRN/e-way; PRODUCTION requires real NIC credentials. */
  nicMode: "DEMO" | "PRODUCTION";
};

export type LineTaxInput = {
  taxableValue: number;
  taxRate: number;
  taxTreatment: TaxTreatment;
};

export type LineTaxResult = {
  taxableValue: number;
  taxRate: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export type InvoiceTaxSummary = {
  taxableValue: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  documentKind: DocumentKind;
  supplyType: SupplyType;
  placeOfSupply: string;
};

export type PlaceOfSupplyInput = {
  transactionPos?: string | null;
  shipToStateCode?: string | null;
  buyerGstin?: string | null;
  buyerStateCode?: string | null;
  tenantDefaultPos?: string | null;
};

export type PlaceOfSupplyResult =
  | { ok: true; stateCode: string }
  | { ok: false; reason: string };
