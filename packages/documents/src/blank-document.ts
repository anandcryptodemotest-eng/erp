import type { DocumentDefinition } from "./types";

/** Empty page — Studio starts here. Tax Invoice seed is opt-in (catalog seed / Power starter). */
export function blankDocumentDefinition(opts?: {
  id?: string;
  name?: string;
  documentType?: string;
}): DocumentDefinition {
  const id = opts?.id ?? "document";
  return {
    id,
    key: id,
    name: opts?.name ?? "New document",
    documentType: opts?.documentType ?? "INVOICE",
    page: {
      size: "A4",
      orientation: "portrait",
      margin: { top: 40, right: 40, bottom: 40, left: 40 },
    },
    items: [],
    studio: { level: "business", mode: "design", tab: "design" },
  };
}
