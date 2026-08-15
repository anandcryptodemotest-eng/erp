import type { DocumentDefinition, StudioLevel } from "@erp/documents";

export const GUIDED_STEPS = [
  { id: "page", label: "Page" },
  { id: "header", label: "Header" },
  { id: "content", label: "Content" },
  { id: "collections", label: "Collections" },
  { id: "summary", label: "Summary" },
  { id: "footer", label: "Footer" },
  { id: "preview", label: "Preview" },
] as const;

export const STUDIO_LEVELS: { id: StudioLevel; label: string }[] = [
  { id: "business", label: "Business" },
  { id: "power", label: "Power" },
  { id: "developer", label: "Developer" },
];

export function studioLevel(def: DocumentDefinition): StudioLevel {
  return def.studio?.level ?? "business";
}

export function patchStudio(
  def: DocumentDefinition,
  studio: NonNullable<DocumentDefinition["studio"]>
): DocumentDefinition {
  return { ...def, studio: { ...def.studio, ...studio } };
}
