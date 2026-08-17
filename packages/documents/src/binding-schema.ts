import type { BindingSchemaLeaf, DocumentBindingSchema } from "./types";

/** Default binding tree for Tax Invoice / INVOICE document types. */
export const INVOICE_BINDING_SCHEMA: DocumentBindingSchema = {
  groups: [
    {
      label: "Invoice",
      fields: [
        { path: "invoice.number", label: "Number" },
        { path: "invoice.date", label: "Date", formatter: "date" },
        { path: "invoice.dueDate", label: "Due date", formatter: "date" },
        { path: "invoice.notes", label: "Notes" },
        { path: "invoice.placeOfSupply", label: "Place of supply" },
        { path: "invoice.placeOfSupplyLabel", label: "Place of supply (labeled)" },
      ],
    },
    {
      label: "Seller",
      fields: [
        { path: "seller.name", label: "Name" },
        { path: "seller.address", label: "Address" },
        { path: "seller.gstin", label: "GSTIN" },
        { path: "seller.stateCode", label: "State code" },
        { path: "seller.gstinMeta", label: "GSTIN meta (header)" },
        { path: "seller.cityState", label: "City / state (header)" },
        { path: "seller.gstinLine", label: "GSTIN line" },
        { path: "seller.stateLine", label: "State line" },
        { path: "seller.signatoryFor", label: "Signatory for" },
        { path: "seller.logoUrl", label: "Logo URL" },
      ],
    },
    {
      label: "Buyer",
      fields: [
        { path: "buyer.name", label: "Name" },
        { path: "buyer.address", label: "Address" },
        { path: "buyer.gstin", label: "GSTIN" },
        { path: "buyer.stateCode", label: "State code" },
        { path: "buyer.gstinLine", label: "GSTIN line" },
        { path: "buyer.stateLine", label: "State line" },
      ],
    },
    {
      label: "Lines",
      fields: [{ path: "lines", label: "Line items (table)", collection: true }],
    },
    {
      label: "Totals",
      fields: [
        { path: "totals.subtotal", label: "Subtotal", formatter: "currency" },
        { path: "totals.tax", label: "GST", formatter: "currency" },
        { path: "totals.total", label: "Total", formatter: "currency" },
      ],
    },
    {
      label: "Payment",
      fields: [
        { path: "payment.upiUri", label: "UPI pay URI" },
        { path: "payment.vpa", label: "UPI VPA" },
        { path: "payment.amountDue", label: "Amount due", formatter: "currency" },
      ],
    },
  ],
};

export function bindingSchemaForDocumentType(documentType: string): DocumentBindingSchema {
  const t = documentType.toUpperCase();
  if (t === "INVOICE" || t === "TAX_INVOICE") return INVOICE_BINDING_SCHEMA;
  return INVOICE_BINDING_SCHEMA;
}

export function listBindingLeaves(schema: DocumentBindingSchema): BindingSchemaLeaf[] {
  return schema.groups.flatMap((g) => g.fields);
}

export function listCollectionLeaves(schema: DocumentBindingSchema): BindingSchemaLeaf[] {
  return listBindingLeaves(schema).filter((f) => f.collection);
}
