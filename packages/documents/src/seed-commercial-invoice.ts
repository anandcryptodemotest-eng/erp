import type { DocumentDefinition } from "./types";
import { TAX_INVOICE_SEED } from "./seed-tax-invoice";

function cloneWithTitle(title: string, id: string, name: string): DocumentDefinition {
  const def = structuredClone(TAX_INVOICE_SEED);
  def.id = id;
  def.key = id;
  def.name = name;
  const header = def.items.find((i) => i.id === "header");
  const titleItem = header?.children?.find((c) => c.id === "title");
  if (titleItem && titleItem.type === "Text") {
    titleItem.properties = { text: title };
  }
  return def;
}

export const COMMERCIAL_INVOICE_SEED: DocumentDefinition = cloneWithTitle("BILL", "commercial-invoice", "Bill");

export const BILL_OF_SUPPLY_SEED: DocumentDefinition = cloneWithTitle(
  "BILL OF SUPPLY",
  "bill-of-supply",
  "Bill of Supply"
);
