/** Sample payload for Studio Data SAMPLE, HTML/PDF preview, and tests. */
export const SAMPLE_DOCUMENT_PAYLOAD: Record<string, unknown> = {
  invoice: { number: "INV-000245", date: "2026-08-14", dueDate: "2026-08-28" },
  seller: {
    name: "Trust Wood Pvt Ltd",
    address: "Plot 12, Timber Yard, Bengaluru 560001",
    gstin: "29AAAAA0000A1Z5",
    logoUrl: "",
  },
  buyer: {
    name: "Acme Retail LLP",
    address: "14 Market Street, Mumbai 400001",
    gstin: "27BBBBB0000B1Z3",
  },
  lines: [
    { sku: "TW-BWP-18", description: "BWP plywood 18mm", qty: 2, rate: 1850, tax: 666, amount: 4366 },
    { sku: "TW-MR-12", description: "MR plywood 12mm", qty: 4, rate: 920, tax: 662.4, amount: 4342.4 },
  ],
  totals: { subtotal: 7380, tax: 1328.4, total: 8708.4 },
};
