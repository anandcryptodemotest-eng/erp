/**
 * Minimal vector PDF writer — no external dependencies.
 * Draws absolutely-positioned text, lines and rectangles onto a single A4/Letter
 * page so the generated PDF matches the WYSIWYG template layout (not just a text dump).
 */

// Adobe standard Helvetica AFM widths (per 1000 units), ASCII 32-126.
// Used for both regular and bold (bold is ~5% wider in reality; close enough for layout/alignment).
const HELVETICA_WIDTHS: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

function charWidth(code: number, bold: boolean): number {
  const idx = code - 32;
  const w = idx >= 0 && idx < HELVETICA_WIDTHS.length ? HELVETICA_WIDTHS[idx] : 556;
  return bold ? w * 1.05 : w;
}

/** Approximate rendered width of `text` at `fontSize` using Helvetica metrics. */
export function textWidth(text: string, fontSize: number, bold = false): number {
  const safe = pdfSafeText(text);
  let total = 0;
  for (let i = 0; i < safe.length; i++) total += charWidth(safe.charCodeAt(i), bold);
  return (total / 1000) * fontSize;
}

/**
 * Helvetica (WinAnsi) cannot paint ₹ / Unicode. Map to ASCII so glyphs do not
 * overlap digits. Full Unicode fonts are BL-025.
 */
export function pdfSafeText(s: string): string {
  let out = "";
  for (const ch of s) {
    if (ch === "₹") {
      out += "Rs.";
      continue;
    }
    const c = ch.charCodeAt(0);
    if (c === 0xa0) {
      out += " ";
      continue;
    }
    if (c < 32) continue;
    out += c > 126 ? "?" : ch;
  }
  return out;
}

function escapePdfText(s: string): string {
  return pdfSafeText(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export type PdfRect = { x: number; y: number; w: number; h: number };

export type PdfImage = {
  /** Raw JPEG (DCTDecode) bytes — the only embeddable format supported without a decoder. */
  bytes: Buffer;
  width: number;
  height: number;
};

export type DrawTextOp = {
  kind: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  bold?: boolean;
  color?: [number, number, number];
};

export type DrawLineOp = { kind: "line"; x1: number; y1: number; x2: number; y2: number; width?: number };
export type DrawRectOp = { kind: "rect"; rect: PdfRect; stroke?: boolean; fill?: [number, number, number] };
export type DrawImageOp = { kind: "image"; rect: PdfRect; image: PdfImage };

export type DrawOp = DrawTextOp | DrawLineOp | DrawRectOp | DrawImageOp;

/**
 * Builds a single-page PDF from absolute draw ops (top-left origin, y-down, matching the HTML preview),
 * converting to PDF's bottom-left/y-up coordinate space internally.
 */
export function buildLayoutPdf(pageWidth: number, pageHeight: number, ops: DrawOp[]): Buffer {
  const toPdfY = (yTop: number) => pageHeight - yTop;

  const content: string[] = [];
  const images: { id: string; image: PdfImage }[] = [];
  let imageCounter = 0;

  for (const op of ops) {
    if (op.kind === "text") {
      const font = op.bold ? "/F2" : "/F1";
      const [r, g, b] = op.color ?? [0, 0, 0];
      const colorOp = r === 0 && g === 0 && b === 0 ? "" : `${r} ${g} ${b} rg\n`;
      content.push(
        `q\n${colorOp}BT\n${font} ${op.fontSize} Tf\n${op.x.toFixed(2)} ${toPdfY(op.y).toFixed(2)} Td\n(${escapePdfText(op.text)}) Tj\nET\nQ`
      );
    } else if (op.kind === "line") {
      content.push(
        `q\n${(op.width ?? 1).toFixed(2)} w\n${op.x1.toFixed(2)} ${toPdfY(op.y1).toFixed(2)} m\n${op.x2.toFixed(2)} ${toPdfY(op.y2).toFixed(2)} l\nS\nQ`
      );
    } else if (op.kind === "rect") {
      const { x, y, w, h } = op.rect;
      const pdfY = toPdfY(y) - h;
      if (op.fill) {
        const [r, g, b] = op.fill;
        content.push(`q\n${r} ${g} ${b} rg\n${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re\nf\nQ`);
      }
      if (op.stroke !== false || !op.fill) {
        content.push(`q\n0.75 w\n${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re\nS\nQ`);
      }
    } else if (op.kind === "image") {
      const id = `Im${++imageCounter}`;
      images.push({ id, image: op.image });
      const { x, y, w, h } = op.rect;
      const pdfY = toPdfY(y) - h;
      content.push(`q\n${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${pdfY.toFixed(2)} cm\n/${id} Do\nQ`);
    }
  }

  const stream = content.join("\n");

  // Object numbering: 1 Catalog, 2 Pages, 3 Page, 4 Content, 5 F1, 6 F2, then images.
  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");

  const imageXObjectRefs = images.map((img, i) => `/${img.id} ${7 + i} 0 R`).join(" ");
  const resources = `<< /Font << /F1 5 0 R /F2 6 0 R >>${
    images.length ? ` /XObject << ${imageXObjectRefs} >>` : ""
  } >>`;
  objects.push(
    `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources ${resources} >>endobj\n`
  );
  objects.push(
    `4 0 obj<< /Length ${Buffer.byteLength(stream, "utf8")} >>stream\n${stream}\nendstream\nendobj\n`
  );
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");
  objects.push("6 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n");

  const binaryChunks: (string | Buffer)[] = [];
  let pdfHead = "%PDF-1.4\n";
  binaryChunks.push(pdfHead);
  const offsets: number[] = [0];
  let runningLength = Buffer.byteLength(pdfHead, "utf8");
  for (const obj of objects) {
    offsets.push(runningLength);
    binaryChunks.push(obj);
    runningLength += Buffer.byteLength(obj, "utf8");
  }
  for (const img of images) {
    offsets.push(runningLength);
    const header = `${7 + images.indexOf(img)} 0 obj<< /Type /XObject /Subtype /Image /Width ${img.image.width} /Height ${img.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.image.bytes.length} >>stream\n`;
    const footer = "\nendstream\nendobj\n";
    binaryChunks.push(header, img.image.bytes, footer);
    runningLength += Buffer.byteLength(header, "utf8") + img.image.bytes.length + Buffer.byteLength(footer, "utf8");
  }

  const totalObjects = objects.length + images.length;
  const xrefStart = runningLength;
  let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjects; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  binaryChunks.push(xref);

  return Buffer.concat(binaryChunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c, "utf8"))));
}

/** Reads width/height from a JPEG's SOF marker. Returns null if not a valid baseline/progressive JPEG. */
export function readJpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < bytes.length - 8) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      return { width, height };
    }
    const segmentLength = bytes.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  return null;
}

export function isJpeg(bytes: Buffer): boolean {
  return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}
