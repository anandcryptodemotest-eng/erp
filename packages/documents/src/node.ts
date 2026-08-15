/** Node-only render / file-store APIs — do not import from Client Components. */

export {
  renderDocument,
  renderDocumentHtml,
  renderDocumentPdfBytes,
  fileStoreRoot,
  invoicePdfPath,
} from "./render";
export type {
  DrawOp,
  DrawTextOp,
  DrawLineOp,
  DrawRectOp,
  DrawImageOp,
  PdfImage,
  PdfRect,
} from "./pdf";
