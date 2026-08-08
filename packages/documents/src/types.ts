import type { AssetRef } from "@erp/workflow";

export type DocumentItemType =
  | "Logo"
  | "Text"
  | "Field"
  | "Table"
  | "Image"
  | "Line"
  | "Box"
  | "QR"
  | "Container";

export type DocumentBinding = {
  path: string;
  formatter?: string;
  fallback?: string;
};

export type DocumentStyle = {
  font?: string;
  fontSize?: number;
  fontWeight?: string | number;
  color?: string;
  background?: string;
  border?: string;
  padding?: number | string;
  margin?: number | string;
  textAlign?: "left" | "center" | "right";
};

export type DocumentVisibility = {
  when?: string;
};

export type DocumentPlacement = {
  area?: "header" | "body" | "footer" | "absolute";
  x: number;
  y: number;
  width: number;
  height?: number;
  align?: "left" | "center" | "right";
};

/**
 * Canvas layer — Figma-like. v1 uses a single default layer;
 * watermark / header / footer / locked template can use additional layers later.
 */
export type DocumentLayer = {
  id: string;
  name: string;
  locked?: boolean;
  visible?: boolean;
  items: PlacedItem[];
};

export type PlacedItem = {
  id: string;
  /** Human-friendly outline label, e.g. "Invoice Number". */
  name?: string;
  type: DocumentItemType;
  placement: DocumentPlacement;
  binding?: DocumentBinding;
  style?: DocumentStyle;
  visibility?: DocumentVisibility;
  properties?: Record<string, unknown>;
  children?: PlacedItem[];
  /** Degrees; unused in renderer initially. */
  rotation?: number;
  locked?: boolean;
  visible?: boolean;
  zIndex?: number;
  opacity?: number;
};

export type DocumentPage = {
  size: "A4" | "Letter";
  orientation?: "portrait" | "landscape";
  margin?: { top: number; right: number; bottom: number; left: number };
};

export type DocumentDefinition = {
  id?: string;
  key?: string;
  name: string;
  documentType: string;
  page: DocumentPage;
  /**
   * Flat item list (legacy / primary for renderer).
   * When `layers` is present, prefer layers; items may mirror default layer for compatibility.
   */
  items: PlacedItem[];
  /** Optional Figma-like layers. If absent, treat `items` as the default layer contents. */
  layers?: DocumentLayer[];
};

/** Schema-driven binding picker — paths relative to payload root. */
export type BindingSchemaLeaf = {
  path: string;
  label: string;
  formatter?: string;
};

export type BindingSchemaGroup = {
  label: string;
  fields: BindingSchemaLeaf[];
};

export type DocumentBindingSchema = {
  groups: BindingSchemaGroup[];
};

export type RenderDocumentInput = {
  assetRef: AssetRef;
  definition: DocumentDefinition;
  payload: Record<string, unknown>;
  /** Absolute path to write the PDF file */
  outputPath: string;
};

export type RenderDocumentResult = {
  assetRef: AssetRef;
  pdfUrl: string;
  checksum: string;
  mimeType: string;
  /** Absolute path written on disk */
  filePath: string;
};
