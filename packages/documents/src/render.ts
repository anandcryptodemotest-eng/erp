import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AssetRef } from "@erp/workflow";
import { formatValue, getByPath, isVisible } from "./resolve";
import { resolveImageUrl } from "./image-url";
import { buildLayoutPdf, isJpeg, readJpegDimensions, textWidth, type DrawOp, type PdfImage } from "./pdf";
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

function renderItemHtml(item: PlacedItem, payload: Record<string, unknown>, ox = 0, oy = 0): string {
  if (!isVisible(item, payload)) return "";
  const x = ox + (item.placement.x ?? 0);
  const y = oy + (item.placement.y ?? 0);
  const w = item.placement.width ?? 100;
  const h = item.placement.height;
  const pos = `position:absolute;left:${x}px;top:${y}px;width:${w}px;${h != null ? `height:${h}px;` : ""}`;

  if (item.type === "Container") {
    // Children use local coords (ox=0,oy=0) inside a page-absolute container —
    // never pass page-absolute offsets into nested renderItemHtml (double-offset bug).
    const kids = (item.children ?? []).map((c) => renderItemHtml(c, payload, 0, 0)).join("");
    const outer = `${pos}overflow:visible`;
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
    const head = columns
      .map((c) => `<th style="text-align:left;padding:4px;border-bottom:1px solid #333;width:${c.width ?? 80}px">${escapeHtml(c.label)}</th>`)
      .join("");
    const body = (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const cells = columns
          .map((c) => {
            const v = formatValue(row[c.key], c.formatter);
            return `<td style="padding:4px;border-bottom:1px solid #eee">${escapeHtml(v)}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    return `<table data-id="${escapeHtml(item.id)}" style="${pos}border-collapse:collapse;font-size:11px"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  if (item.type === "Line") {
    return `<div data-id="${escapeHtml(item.id)}" style="${pos}height:1px;background:#333"></div>`;
  }

  if (item.type === "Box") {
    return `<div data-id="${escapeHtml(item.id)}" style="${pos}border:1px solid #333;box-sizing:border-box"></div>`;
  }

  return "";
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
  const pageH = definition.page.size === "Letter" ? 792 : 842;
  const pageW = definition.page.size === "Letter" ? 612 : 595;
  const margin = definition.page.margin ?? { top: 40, right: 40, bottom: 40, left: 40 };
  const inner = definition.items.map((i) => renderItemHtml(i, payload, margin.left, margin.top)).join("");
  const selectedStyle = opts.selectedId
    ? `[data-id="${escapeHtml(opts.selectedId)}"]{outline:2px solid #10b981;outline-offset:1px}`
    : "";
  const clickScript = opts.interactive
    ? `<script>document.addEventListener("click",function(e){var el=e.target.closest("[data-id]");if(!el)return;e.preventDefault();window.parent.postMessage({source:"erp-document-preview",id:el.getAttribute("data-id")},"*");});</script>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(definition.name)}</title>
<style>body{margin:0;font-family:Helvetica,Arial,sans-serif;background:#f3f3f3}
.page{position:relative;width:${pageW}px;height:${pageH}px;margin:16px auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15)}
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
    ops.push({ kind: "text", x: tx, y: y + fontSize, text, fontSize, bold });
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
    ops.push({ kind: "line", x1: x, y1: y, x2: x + w, y2: y });
    return;
  }

  if (item.type === "Box") {
    ops.push({ kind: "rect", rect: { x, y, w, h: item.placement.height ?? 20 }, stroke: true });
    return;
  }

  if (item.type === "Table") {
    const rows = (item.binding ? getByPath(payload, item.binding.path) : []) as Record<string, unknown>[];
    const columns =
      (item.properties?.columns as { key: string; label: string; width?: number; formatter?: string }[]) ?? [];
    let colX = x;
    const colOffsets: number[] = [];
    for (const col of columns) {
      colOffsets.push(colX);
      colX += col.width ?? 80;
    }
    columns.forEach((col, i) => {
      ops.push({ kind: "text", x: colOffsets[i] + 4, y: y + 12, text: col.label, fontSize: 10, bold: true });
    });
    ops.push({ kind: "line", x1: x, y1: y + TABLE_ROW_HEIGHT, x2: colX, y2: y + TABLE_ROW_HEIGHT });
    const dataRows = Array.isArray(rows) ? rows : [];
    dataRows.forEach((row, rIdx) => {
      const rowY = y + TABLE_ROW_HEIGHT * (rIdx + 1);
      columns.forEach((col, i) => {
        const v = formatValue(row[col.key], col.formatter);
        ops.push({ kind: "text", x: colOffsets[i] + 4, y: rowY + 12, text: v, fontSize: 9 });
      });
      ops.push({ kind: "line", x1: x, y1: rowY + TABLE_ROW_HEIGHT, x2: colX, y2: rowY + TABLE_ROW_HEIGHT, width: 0.5 });
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

  const imageUrls = new Set<string>();
  for (const item of definition.items) collectImageUrls(item, payload, imageUrls);
  const resolvedImages = new Map<string, PdfImage | null>();
  await Promise.all(
    [...imageUrls].map(async (url) => {
      resolvedImages.set(url, await resolveImage(url));
    })
  );

  const margin = definition.page.margin ?? { top: 40, right: 40, bottom: 40, left: 40 };
  const ops: DrawOp[] = [];
  for (const item of definition.items) {
    collectDrawOps(item, payload, margin.left, margin.top, resolvedImages, ops);
  }
  const pageW = definition.page.size === "Letter" ? 612 : 595;
  const pageH = definition.page.size === "Letter" ? 792 : 842;
  const buf = buildLayoutPdf(pageW, pageH, ops);
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

export function fileStoreRoot(): string {
  return process.env.FILE_STORE_ROOT || "/tmp/erp-files";
}

export function invoicePdfPath(tenantId: string, invoiceId: string): string {
  return `${fileStoreRoot()}/${tenantId}/invoices/${invoiceId}.pdf`;
}

export type { AssetRef };
