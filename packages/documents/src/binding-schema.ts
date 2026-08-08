import type { DocumentBindingSchema } from "./types";

/** Default binding tree for Tax Invoice / INVOICE document types. */
export const INVOICE_BINDING_SCHEMA: DocumentBindingSchema = {
  groups: [
    {
      label: "Invoice",
      fields: [
        { path: "invoice.number", label: "Number" },
        { path: "invoice.date", label: "Date", formatter: "date" },
        { path: "invoice.dueDate", label: "Due date", formatter: "date" },
      ],
    },
    {
      label: "Seller",
      fields: [
        { path: "seller.name", label: "Name" },
        { path: "seller.address", label: "Address" },
        { path: "seller.gstin", label: "GSTIN" },
        { path: "seller.logoUrl", label: "Logo URL" },
      ],
    },
    {
      label: "Buyer",
      fields: [
        { path: "buyer.name", label: "Name" },
        { path: "buyer.address", label: "Address" },
        { path: "buyer.gstin", label: "GSTIN" },
      ],
    },
    {
      label: "Lines",
      fields: [{ path: "lines", label: "Line items (table)" }],
    },
    {
      label: "Totals",
      fields: [
        { path: "totals.subtotal", label: "Subtotal", formatter: "currency" },
        { path: "totals.tax", label: "GST", formatter: "currency" },
        { path: "totals.total", label: "Grand Total", formatter: "currency" },
      ],
    },
  ],
};

export function bindingSchemaForDocumentType(documentType: string): DocumentBindingSchema {
  const t = documentType.toUpperCase();
  if (t === "INVOICE" || t === "TAX_INVOICE") return INVOICE_BINDING_SCHEMA;
  return INVOICE_BINDING_SCHEMA;
}
