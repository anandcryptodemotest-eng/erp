import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AssetRef } from "@erp/workflow";
import { formatValue, getByPath, isVisible } from "./resolve";
import { resolveImageUrl } from "./image-url";
import { buildLayoutPdf, isJpeg, readJpegDimensions, textWidth, type DrawOp, type PdfImage } from "./pdf";
import { expandDocumentDefinition } from "./print-widgets";
import { qrCaptionFromItem, qrSourceFromItem, resolveQRData } from "./qr-data";
import { encodeQRMatrix, qrMatrixToSvg } from "./qr-matrix";
import type {
  DocumentDefinition,
  PlacedItem,
  RenderDocumentInput,
  RenderDocumentResult,
} from "./types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ACCENT = "#173f5f";
const LINE_SOFT = "#dbe2ea";

function parseCssColor(input?: string): [number, number, number] | null {
  if (!input) return null;
  const hex = input.trim();
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function styleAttr(style?: PlacedItem["style"]): string {
  if (!style) return "";
  const parts: string[] = [];
  if (style.fontSize) parts.push(`font-size:${style.fontSize}px`);
  if (style.fontWeight) parts.push(`font-weight:${style.fontWeight}`);
  if (style.color) parts.push(`color:${style.color}`);
  if (style.background) parts.push(`background:${style.background}`);
  if (style.textAlign) parts.push(`text-align:${style.textAlign}`);
  if (style.border) parts.push(`border:${style.border}`);
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

function colRightAligned(col: { key: string; formatter?: string }): boolean {
  return (
    col.formatter === "currency" ||
    col.key === "qty" ||
    col.key === "taxRate" ||
    col.key === "tax" ||
    col.key === "rate" ||
    col.key === "amount"
  );
}

function itemBoxStyle(item: PlacedItem, ox: number, oy: number, includeHeight: boolean): string {
  const x = ox + (item.placement.x ?? 0);
  const y = oy + (item.placement.y ?? 0);
  const w = item.placement.width ?? 100;
  const h = item.placement.height;
  // Tables must not get a fixed CSS height — browsers stretch the single body row
  // to fill it (huge gap between header and first line).
  const height = includeHeight && h != null ? `height:${h}px;` : "";
  return `position:absolute;left:${x}px;top:${y}px;width:${w}px;${height}line-height:1.2;overflow:hidden;`;
}

function renderItemHtml(item: PlacedItem, payload: Record<string, unknown>, ox = 0, oy = 0): string {
  if (!isVisible(item, payload)) return "";
  const pos = itemBoxStyle(item, ox, oy, item.type !== "Table");

  if (item.type === "Container") {
    // Children use local coords (ox=0,oy=0) inside a page-absolute container —
    // never pass page-absolute offsets into nested renderItemHtml (double-offset bug).
    const kids = (item.children ?? []).map((c) => renderItemHtml(c, payload, 0, 0)).join("");
    const outer = `${pos}overflow:hidden;line-height:1.2`;
    return `<div data-id="${escapeHtml(item.id)}" style="${outer}"><div style="position:relative;width:100%;height:100%">${kids}</div></div>`;
  }

  if (item.type === "Text") {
    const text = String(item.properties?.text ?? "");
    return `<div data-id="${escapeHtml(item.id)}" style="${pos}"${styleAttr(item.style)}>${escapeHtml(text)}</div>`;
  }

  if (item.type === "Field" || item.type === "Logo" || item.type === "Image") {
    if (item.type === "Logo" || item.type === "Image") {
      const url = resolveImageUrl(item, payload, getByPath);
      if (!url) {
        return `<div data-id="${escapeHtml(item.id)}" style="${pos}border:1px dashed #ccc;font-size:10px;color:#999;display:flex;align-items:center;justify-content:center">${item.type === "Logo" ? "Logo" : "Image"}</div>`;
      }
      return `<img data-id="${escapeHtml(item.id)}" src="${escapeHtml(url)}" alt="" style="${pos}object-fit:contain" />`;
    }
    const raw = item.binding ? getByPath(payload, item.binding.path) : undefined;
    const text = formatValue(raw, item.binding?.formatter, item.binding?.fallback ?? "");
    return `<div data-id="${escapeHtml(item.id)}" style="${pos}"${styleAttr(item.style)}>${escapeHtml(text)}</div>`;
  }

  if (item.type === "Table") {
    const rows = (item.binding ? getByPath(payload, item.binding.path) : []) as Record<
      string,
      unknown
    >[];
    const columns = (item.properties?.columns as { key: string; label: string; width?: number; formatter?: string }[]) ?? [];
    const headerBg = String(item.properties?.headerBackground ?? ACCENT);
    const head = columns
      .map((c) => {
        const align = colRightAligned(c) ? "right" : "left";
        return `<th style="text-align:${align};padding:8px 7px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border:none;width:${c.width ?? 80}px">${escapeHtml(c.label)}</th>`;
      })
      .join("");
    const body = (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const cells = columns
          .map((c) => {
            const v = formatValue(row[c.key], c.formatter);
            const align = colRightAligned(c) ? "right" : "left";
            return `<td style="padding:8px 7px;border-bottom:1px solid ${LINE_SOFT};border-left:none;border-right:none;text-align:${align};font-size:10px;vertical-align:top">${escapeHtml(v)}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    return `<table data-id="${escapeHtml(item.id)}" style="${pos}border-collapse:collapse;table-layout:fixed;font-size:11px"><thead><tr style="background:${escapeHtml(headerBg)}">${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  if (item.type === "Line") {
    const bg = item.style?.background ?? item.style?.color ?? "#333";
    return `<div data-id="${escapeHtml(item.id)}" style="${pos}height:1px;background:${escapeHtml(bg)}"></div>`;
  }

  if (item.type === "Box") {
    const bg = item.style?.background ?? "transparent";
    const border = item.style?.border ?? `1px solid ${LINE_SOFT}`;
    return `<div data-id="${escapeHtml(item.id)}" style="${pos}background:${escapeHtml(bg)};border:${escapeHtml(border)};border-radius:3px;box-sizing:border-box"></div>`;
  }

  if (item.type === "QR") {
    return renderQrHtml(item, payload, pos);
  }

  return "";
}

function renderQrHtml(item: PlacedItem, payload: Record<string, unknown>, pos: string): string {
  const data = resolveQRData(qrSourceFromItem(item), payload);
  if (!data) return "";
  const width = item.placement.width ?? 72;
  const boxH = item.placement.height ?? 72;
  const caption = qrCaptionFromItem(item);
  const matrixH = caption ? Math.max(24, boxH - 16) : boxH;
  const matrix = encodeQRMatrix(data);
  const svg = qrMatrixToSvg(matrix, width, matrixH);
  const captionHtml = caption
    ? `<div style="position:absolute;left:0;top:${matrixH}px;width:${width}px;font-size:8px;text-align:center;color:#64748b">${escapeHtml(caption)}</div>`
    : "";
  return `<div data-id="${escapeHtml(item.id)}" data-qr="${escapeHtml(data)}" style="${pos}">${svg}${captionHtml}</div>`;
}

/**
 * HTML preview for Document Studio / widget (A4 ≈ 595×842 CSS px at 72dpi).
 * When `opts.interactive` is set, clicking any element posts its `data-id` to the parent
 * window (`{ source: "erp-document-preview", id }`) so the Studio can select it, and the
 * currently selected item is outlined.
 */
export function renderDocumentHtml(
  definition: DocumentDefinition,
  payload: Record<string, unknown>,
  opts: { interactive?: boolean; selectedId?: string | null } = {}
): string {
  const expanded = expandDocumentDefinition(definition);
  const pageH = expanded.page.size === "Letter" ? 792 : 842;
  const pageW = expanded.page.size === "Letter" ? 612 : 595;
  const margin = expanded.page.margin ?? { top: 40, right: 40, bottom: 40, left: 40 };
  const inner = expanded.items.map((i) => renderItemHtml(i, payload, margin.left, margin.top)).join("");
  const selectedStyle = opts.selectedId
    ? `[data-id="${escapeHtml(opts.selectedId)}"]{outline:2px solid #10b981;outline-offset:1px}`
    : "";
  const clickScript = opts.interactive
    ? `<script>document.addEventListener("click",function(e){var el=e.target.closest("[data-id]");if(!el)return;e.preventDefault();window.parent.postMessage({source:"erp-document-preview",id:el.getAttribute("data-id")},"*");});</script>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(definition.name)}</title>
<style>body{margin:0;font-family:Helvetica,Arial,sans-serif;background:#f3f3f3}
.page{position:relative;width:${pageW}px;height:${pageH}px;margin:16px auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15)}
table[data-id]{height:auto!important}
table[data-id] th,table[data-id] td{height:auto;vertical-align:top}
[data-id]{cursor:${opts.interactive ? "pointer" : "default"}}
${selectedStyle}
</style></head><body><div class="page">${inner}</div>${clickScript}</body></html>`;
}

const IMAGE_FETCH_TIMEOUT_MS = 4000;

async function resolveImage(url: string): Promise<PdfImage | null> {
  try {
    let bytes: Buffer;
    if (url.startsWith("data:")) {
      const match = /^data:([^;]+);base64,(.*)$/s.exec(url);
      if (!match) return null;
      bytes = Buffer.from(match[2], "base64");
    } else if (/^https?:\/\//.test(url)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        bytes = Buffer.from(await res.arrayBuffer());
      } finally {
        clearTimeout(timer);
      }
    } else {
      return null;
    }
    // Only JPEG (DCTDecode) can be embedded directly without a PNG/zlib decoder.
    if (!isJpeg(bytes)) return null;
    const dims = readJpegDimensions(bytes);
    if (!dims) return null;
    return { bytes, width: dims.width, height: dims.height };
  } catch {
    return null;
  }
}

function collectImageUrls(item: PlacedItem, payload: Record<string, unknown>, urls: Set<string>): void {
  if (!isVisible(item, payload)) return;
  if (item.type === "Container") {
    for (const c of item.children ?? []) collectImageUrls(c, payload, urls);
    return;
  }
  if (item.type === "Logo" || item.type === "Image") {
    const url = resolveImageUrl(item, payload, getByPath);
    if (url) urls.add(url);
  }
}

function fitContain(imgW: number, imgH: number, boxW: number, boxH: number): { w: number; h: number; x: number; y: number } {
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { w, h, x: (boxW - w) / 2, y: (boxH - h) / 2 };
}

const TABLE_ROW_HEIGHT = 18;

function collectQrDrawOps(
  item: PlacedItem,
  payload: Record<string, unknown>,
  x: number,
  y: number,
  w: number,
  ops: DrawOp[]
): void {
  const data = resolveQRData(qrSourceFromItem(item), payload);
  if (!data) return;
  const boxH = item.placement.height ?? 72;
  const caption = qrCaptionFromItem(item);
  const matrixH = caption ? Math.max(24, boxH - 16) : boxH;
  const matrix = encodeQRMatrix(data);
  const n = matrix.size;
  if (n <= 0) return;
  const module = Math.min(w, matrixH) / n;
  const grid = module * n;
  const gx = x + (w - grid) / 2;
  const gy = y;
  ops.push({
    kind: "rect",
    rect: { x: gx, y: gy, w: grid, h: grid },
    fill: [1, 1, 1],
    stroke: false,
  });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix.get(r, c)) continue;
      ops.push({
        kind: "rect",
        rect: { x: gx + c * module, y: gy + r * module, w: module, h: module },
        fill: [0, 0, 0],
        stroke: false,
      });
    }
  }
  if (caption) {
    const fontSize = 8;
    const tw = textWidth(caption, fontSize);
    ops.push({
      kind: "text",
      x: x + (w - tw) / 2,
      y: y + matrixH + fontSize,
      text: caption,
      fontSize,
    });
  }
}

function collectDrawOps(
  item: PlacedItem,
  payload: Record<string, unknown>,
  ox: number,
  oy: number,
  images: Map<string, PdfImage | null>,
  ops: DrawOp[]
): void {
  if (!isVisible(item, payload)) return;
  const x = ox + (item.placement.x ?? 0);
  const y = oy + (item.placement.y ?? 0);
  const w = item.placement.width ?? 100;
  const align = item.placement.align ?? item.style?.textAlign;

  if (item.type === "Container") {
    for (const c of item.children ?? []) collectDrawOps(c, payload, x, y, images, ops);
    return;
  }

  if (item.type === "Text" || item.type === "Field") {
    const fontSize = item.style?.fontSize ?? 10;
    const bold = item.style?.fontWeight === 700 || item.style?.fontWeight === "bold" || Number(item.style?.fontWeight) >= 600;
    const text =
      item.type === "Text"
        ? String(item.properties?.text ?? "")
        : formatValue(
            item.binding ? getByPath(payload, item.binding.path) : undefined,
            item.binding?.formatter,
            item.binding?.fallback ?? ""
          );
    if (!text) return;
    const tw = textWidth(text, fontSize, bold);
    const tx = align === "right" ? x + w - tw : align === "center" ? x + (w - tw) / 2 : x;
    const color = parseCssColor(item.style?.color) ?? undefined;
    ops.push({ kind: "text", x: tx, y: y + fontSize, text, fontSize, bold, color });
    return;
  }

  if (item.type === "Logo" || item.type === "Image") {
    const h = item.placement.height ?? 40;
    const url = resolveImageUrl(item, payload, getByPath);
    const image = url ? images.get(url) : null;
    if (image) {
      const fit = fitContain(image.width, image.height, w, h);
      ops.push({ kind: "image", rect: { x: x + fit.x, y: y + fit.y, w: fit.w, h: fit.h }, image });
    } else {
      ops.push({ kind: "rect", rect: { x, y, w, h }, stroke: true });
      const label = item.type === "Logo" ? "LOGO" : item.id;
      ops.push({ kind: "text", x: x + 4, y: y + h / 2 + 3, text: label, fontSize: 8 });
    }
    return;
  }

  if (item.type === "Line") {
    ops.push({ kind: "line", x1: x, y1: y, x2: x + w, y2: y, width: 0.75 });
    return;
  }

  if (item.type === "Box") {
    const h = item.placement.height ?? 20;
    const fill = parseCssColor(item.style?.background) ?? undefined;
    ops.push({
      kind: "rect",
      rect: { x, y, w, h },
      fill,
      stroke: true,
    });
    return;
  }

  if (item.type === "QR") {
    collectQrDrawOps(item, payload, x, y, w, ops);
    return;
  }

  if (item.type === "Table") {
    const rows = (item.binding ? getByPath(payload, item.binding.path) : []) as Record<string, unknown>[];
    const columns =
      (item.properties?.columns as { key: string; label: string; width?: number; formatter?: string }[]) ?? [];
    const headerBg =
      parseCssColor(String(item.properties?.headerBackground ?? ACCENT)) ??
      parseCssColor(ACCENT)!;
    let colX = x;
    const colOffsets: number[] = [];
    for (const col of columns) {
      colOffsets.push(colX);
      colX += col.width ?? 80;
    }
    const headerH = TABLE_ROW_HEIGHT + 4;
    ops.push({
      kind: "rect",
      rect: { x, y, w: colX - x, h: headerH },
      fill: headerBg,
      stroke: false,
    });
    columns.forEach((col, i) => {
      const label = col.label;
      const colW = col.width ?? 80;
      const tw = textWidth(label, 8, true);
      const right = colRightAligned(col);
      const tx = right ? colOffsets[i] + colW - 4 - tw : colOffsets[i] + 4;
      ops.push({
        kind: "text",
        x: tx,
        y: y + 12,
        text: label,
        fontSize: 8,
        bold: true,
        color: [1, 1, 1],
      });
    });
    const dataRows = Array.isArray(rows) ? rows : [];
    dataRows.forEach((row, rIdx) => {
      const rowY = y + headerH + TABLE_ROW_HEIGHT * rIdx;
      columns.forEach((col, i) => {
        const v = formatValue(row[col.key], col.formatter);
        const colW = col.width ?? 80;
        const right = colRightAligned(col);
        const tw = textWidth(v, 9);
        const tx = right ? colOffsets[i] + colW - 4 - tw : colOffsets[i] + 4;
        ops.push({ kind: "text", x: tx, y: rowY + 12, text: v, fontSize: 9 });
      });
      ops.push({
        kind: "line",
        x1: x,
        y1: rowY + TABLE_ROW_HEIGHT,
        x2: colX,
        y2: rowY + TABLE_ROW_HEIGHT,
        width: 0.5,
      });
    });
  }
}

/**
 * Formal render contract: definition + payload → PDF on disk.
 * Renders the actual template layout (positions, tables, borders, alignment, embedded JPEG
 * logos) so the generated PDF matches the Document Studio preview 1:1 — not a plain text dump.
 * Returns public pdfUrl path provided by caller via rewriting outputPath → url.
 */
export async function renderDocument(
  input: RenderDocumentInput & { publicUrl: string }
): Promise<RenderDocumentResult> {
  const { assetRef, definition, payload, outputPath, publicUrl } = input;
  const buf = await renderDocumentPdfBytes(definition, payload);
  const checksum = createHash("sha256").update(buf).digest("hex");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buf);
  return {
    assetRef,
    pdfUrl: publicUrl,
    checksum,
    mimeType: "application/pdf",
    filePath: outputPath,
  };
}

/** Same layout as HTML preview — bytes only (Studio download / tests). */
export async function renderDocumentPdfBytes(
  definition: DocumentDefinition,
  payload: Record<string, unknown>
): Promise<Buffer> {
  const expanded = expandDocumentDefinition(definition);
  const imageUrls = new Set<string>();
  for (const item of expanded.items) collectImageUrls(item, payload, imageUrls);
  const resolvedImages = new Map<string, PdfImage | null>();
  await Promise.all(
    [...imageUrls].map(async (url) => {
      resolvedImages.set(url, await resolveImage(url));
    })
  );
  const margin = expanded.page.margin ?? { top: 40, right: 40, bottom: 40, left: 40 };
  const ops: DrawOp[] = [];
  for (const item of expanded.items) {
    collectDrawOps(item, payload, margin.left, margin.top, resolvedImages, ops);
  }
  const pageW = expanded.page.size === "Letter" ? 612 : 595;
  const pageH = expanded.page.size === "Letter" ? 792 : 842;
  return buildLayoutPdf(pageW, pageH, ops);
}

export function fileStoreRoot(): string {
  return process.env.FILE_STORE_ROOT || "/tmp/erp-files";
}

export function invoicePdfPath(tenantId: string, invoiceId: string): string {
  return `${fileStoreRoot()}/${tenantId}/invoices/${invoiceId}.pdf`;
}

export type { AssetRef };
