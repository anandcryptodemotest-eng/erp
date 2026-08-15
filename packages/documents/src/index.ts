/** Browser-safe public API — no Node fs/crypto. Use `@erp/documents/render` for PDF/HTML file output. */

export type {
  DocumentBinding,
  DocumentBindingSchema,
  BindingSchemaGroup,
  BindingSchemaLeaf,
  DocumentDefinition,
  DocumentItemType,
  DocumentLayer,
  DocumentPage,
  DocumentPlacement,
  DocumentStyle,
  DocumentVisibility,
  PlacedItem,
  RenderDocumentInput,
  RenderDocumentResult,
  StudioLevel,
} from "./types";
export { TAX_INVOICE_SEED } from "./seed-tax-invoice";
export { blankDocumentDefinition } from "./blank-document";
export { SAMPLE_DOCUMENT_PAYLOAD } from "./sample-payload";
export { COMMERCIAL_INVOICE_SEED, BILL_OF_SUPPLY_SEED } from "./seed-commercial-invoice";
export {
  getByPath,
  formatValue,
  isVisible,
  formatWords,
  numberToIndianWords,
  registerFormatter,
  getFormatter,
  listFormatters,
} from "./resolve";
export type { Formatter, FormatterId } from "./resolve";
export {
  INVOICE_BINDING_SCHEMA,
  bindingSchemaForDocumentType,
  listBindingLeaves,
  listCollectionLeaves,
} from "./binding-schema";
export {
  LOGO_SIZE_PRESETS,
  recommendedLogoPixels,
  resolveImageUrl,
} from "./image-url";
export type { LogoSizePreset } from "./image-url";
export {
  listBindingSchemaPaths,
  setByPath,
  applyPayloadOverrides,
} from "./payload-overrides";
export type { PayloadOverride } from "./payload-overrides";
export {
  findItemById,
  updateItemById,
  removeItemById,
  addItemToParent,
  flattenItems,
  generateItemId,
} from "./tree";
export {
  PRINT_WIDGET_CATALOG,
  expandWidgets,
  expandDocumentDefinition,
  isPrintWidgetId,
  printWidgetById,
} from "./print-widgets";
export type { PrintWidgetId, PrintWidgetSlot, PrintWidgetCatalogEntry } from "./print-widgets";
