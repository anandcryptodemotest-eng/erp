const fs = require('fs');
const path = require('path');

const sourceFile = process.argv[2] ?? 'SANKALP-ERP-PROPOSAL.md';
const outputFile = process.argv[3] ?? 'SANKALP-ERP-PROPOSAL.pdf';
const sourcePath = path.join(__dirname, '..', 'docs', sourceFile);
const outputPath = path.join(__dirname, '..', 'docs', outputFile);
const logoPath = path.join(__dirname, '..', 'docs', 'assets', 'sankalp-platforms-logo.jpg');
const source = fs.readFileSync(sourcePath, 'utf8');
const logoJpeg = fs.readFileSync(logoPath);
const pages = source.split('<!-- PAGE -->').map((page) => page.trim()).filter(Boolean);
const coverTitle = pages[0].match(/^# (.+)$/m)?.[1] ?? 'SANKALP';
const coverClient = pages[0].match(/\*\*Prepared for:\*\*\s*(.+)$/m)?.[1]?.trim() ?? 'Client';
const coverDate = pages[0].match(/\*\*Date:\*\*\s*(.+)$/m)?.[1]?.trim() ?? '';
const coverVersion = pages[0].match(/\*\*Version:\*\*\s*(.+)$/m)?.[1]?.trim() ?? '1.0';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const CONTENT_BOTTOM = 58;
const NAVY = [0.035, 0.12, 0.19];
const TEAL = [0.0, 0.45, 0.43];
const LIGHT = [0.94, 0.97, 0.96];
const MID = [0.35, 0.42, 0.44];
const BLACK = [0.08, 0.1, 0.11];

function pdfSafe(value) {
  return String(value ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/[—–−]/g, '-')
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/\u00a0/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/[^\t\n\r\x20-\x7e]/g, '');
}

function pdfEscape(value) {
  return pdfSafe(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function textWidth(text, size) {
  return pdfSafe(text).length * size * 0.5;
}

function wrap(text, maxChars) {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textCommand(font, size, color, x, y, text) {
  return `${color.join(' ')} rg\nBT\n/${font} ${size} Tf\n${x} ${y} Td\n(${pdfEscape(text)}) Tj\nET\n`;
}

function rect(color, x, y, width, height) {
  return `${color.join(' ')} rg\n${x} ${y} ${width} ${height} re\nf\n`;
}

function line(color, x1, y1, x2, y2, width = 1) {
  return `${color.join(' ')} RG\n${width} w\n${x1} ${y1} m\n${x2} ${y2} l\nS\n`;
}

function jpegSize(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  throw new Error(`Could not read JPEG size: ${logoPath}`);
}

function drawImage(name, x, y, w, h) {
  return `q\n${w} 0 0 ${h} ${x} ${y} cm\n/${name} Do\nQ\n`;
}

function parseTableCells(line) {
  return line.split('|').slice(1, -1).map((cell) => pdfSafe(cell.trim()));
}

function collectTable(lines, startIndex) {
  const rows = [];
  let index = startIndex;
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed.startsWith('|')) break;
    if (trimmed.startsWith('|---') || trimmed.startsWith('| ---') || /^\|(?:\s*:?-+:?\s*\|)+/.test(trimmed)) {
      index += 1;
      continue;
    }
    rows.push(parseTableCells(trimmed));
    index += 1;
  }
  return { rows, nextIndex: index };
}

function drawTable(rows, startY) {
  if (!rows.length) return { out: '', nextY: startY };
  const colCount = Math.max(...rows.map((row) => row.length));
  const tableWidth = CONTENT_WIDTH;
  const padX = 8;
  const rowH = 20;
  let colWidths;
  if (colCount === 2) colWidths = [tableWidth * 0.68, tableWidth * 0.32];
  else if (colCount === 3) colWidths = [tableWidth * 0.52, tableWidth * 0.18, tableWidth * 0.30];
  else colWidths = Array.from({ length: colCount }, () => tableWidth / colCount);

  let out = '';
  let y = startY;
  rows.forEach((cells, rowIndex) => {
    const joined = cells.join(' ');
    const isHeader = rowIndex === 0;
    const isTotal = /total/i.test(joined);
    const bg = isHeader ? NAVY : isTotal ? LIGHT : rowIndex % 2 === 0 ? [0.97, 0.98, 0.98] : [1, 1, 1];
    const fg = isHeader ? [1, 1, 1] : BLACK;
    const font = isHeader || isTotal ? 'F2' : 'F1';
    out += rect(bg, MARGIN_X - 2, y - 6, tableWidth + 4, rowH);
    let x = MARGIN_X;
    for (let col = 0; col < colCount; col += 1) {
      const text = cells[col] || '';
      const maxChars = Math.max(8, Math.floor(colWidths[col] / 5));
      const display = text.length > maxChars ? `${text.slice(0, maxChars - 1)}.` : text;
      const alignRight = col > 0;
      const textX = alignRight
        ? x + colWidths[col] - padX - textWidth(display, 9)
        : x + padX;
      out += textCommand(font, 9, fg, textX, y + 2, display);
      x += colWidths[col];
    }
    y -= rowH;
  });
  return { out, nextY: y - 8 };
}

function drawArchitectureBlock(lines, x, y) {
  const blockWidth = 470;
  const lineHeight = 15;
  const blockHeight = lines.length * lineHeight + 24;
  let out = rect(LIGHT, x, y - blockHeight + 10, blockWidth, blockHeight);
  out += `${NAVY.join(' ')} rg\nBT\n/F3 9 Tf\n`;
  lines.forEach((lineText, index) => {
    out += `${x + 14} ${y - index * lineHeight} Td\n(${pdfEscape(lineText)}) Tj\n0 -${lineHeight} Td\n`;
  });
  out += 'ET\n';
  return { out, nextY: y - blockHeight - 18 };
}

function renderPage(markdown, pageIndex) {
  const lines = markdown.split(/\r?\n/);
  let out = '';
  const isCover = pageIndex === 0;
  if (isCover) {
    out += rect(NAVY, 0, 0, PAGE_WIDTH, 548);
    out += rect([1, 1, 1], 0, 548, PAGE_WIDTH, PAGE_HEIGHT - 548);
    out += rect(TEAL, 0, 0, PAGE_WIDTH, 10);
    const logoSize = 200;
    out += drawImage('Im1', (PAGE_WIDTH - logoSize) / 2, 590, logoSize, logoSize);
    out += textCommand('F2', 28, [1, 1, 1], 58, 470, coverTitle.toUpperCase());
    out += textCommand('F1', 16, [0.75, 0.95, 0.93], 60, 432, 'ENTERPRISE PLATFORM');
    out += line([0.75, 0.95, 0.93], 60, 408, 220, 408, 2);
    out += textCommand('F2', 13, [1, 1, 1], 60, 368, 'Business Operations, Finance');
    out += textCommand('F2', 13, [1, 1, 1], 60, 347, 'and Workforce Management Proposal');
    out += textCommand('F1', 10, [0.78, 0.84, 0.85], 60, 90, `Prepared by Sankalp Platforms | ${coverClient}${coverDate ? ` | ${coverDate}` : ''}`);
    out += textCommand('F1', 9, [0.65, 0.75, 0.76], 60, 65, `Confidential proposal | Version ${coverVersion}`);
    return out;
  }

  out += rect(NAVY, 0, PAGE_HEIGHT - 50, PAGE_WIDTH, 50);
  out += rect([1, 1, 1], 12, PAGE_HEIGHT - 46, 36, 36);
  out += drawImage('Im1', 12, PAGE_HEIGHT - 46, 36, 36);
  out += textCommand('F2', 11, [1, 1, 1], 56, PAGE_HEIGHT - 31, 'SANKALP PLATFORMS');
  out += textCommand('F1', 8, [0.78, 0.88, 0.88], PAGE_WIDTH - 108, PAGE_HEIGHT - 31, `PROPOSAL / ${String(pageIndex).padStart(2, '0')}`);
  let y = PAGE_HEIGHT - 83;
  let inCode = false;
  let codeLines = [];

  for (let index = 0; index < lines.length; ) {
    if (y < CONTENT_BOTTOM + 24) break;
    const raw = lines[index].trimEnd();
    const trimmed = raw.trim();
    if (!trimmed) {
      y -= 8;
      index += 1;
      continue;
    }
    if (trimmed === '```') {
      if (inCode) {
        const result = drawArchitectureBlock(codeLines, MARGIN_X, y);
        out += result.out;
        y = result.nextY;
        codeLines = [];
      }
      inCode = !inCode;
      index += 1;
      continue;
    }
    if (inCode) {
      codeLines.push(trimmed);
      index += 1;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      out += textCommand('F2', 23, NAVY, MARGIN_X, y, pdfSafe(trimmed.slice(2)));
      out += line(TEAL, MARGIN_X, y - 12, PAGE_WIDTH - MARGIN_X, y - 12, 2);
      y -= 38;
      index += 1;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      out += textCommand('F2', 14, TEAL, MARGIN_X, y, pdfSafe(trimmed.slice(3)));
      y -= 23;
      index += 1;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      out += textCommand('F2', 11, NAVY, MARGIN_X, y, pdfSafe(trimmed.slice(4)));
      y -= 18;
      index += 1;
      continue;
    }
    if (trimmed.startsWith('|')) {
      const table = collectTable(lines, index);
      const drawn = drawTable(table.rows, y);
      out += drawn.out;
      y = drawn.nextY;
      index = table.nextIndex;
      continue;
    }
    if (trimmed.startsWith('- ')) {
      out += textCommand('F2', 10, TEAL, MARGIN_X, y, '*');
      const bulletLines = wrap(pdfSafe(trimmed.slice(2)), 82);
      bulletLines.forEach((lineText, lineIndex) => {
        out += textCommand('F1', 9.3, BLACK, MARGIN_X + 15, y - lineIndex * 14, lineText);
      });
      y -= bulletLines.length * 14 + 5;
      index += 1;
      continue;
    }
    if (/^\d+\. /.test(trimmed)) {
      const numberedLines = wrap(pdfSafe(trimmed), 84);
      numberedLines.forEach((lineText, lineIndex) => {
        out += textCommand('F1', 9.3, BLACK, MARGIN_X, y - lineIndex * 14, lineText);
      });
      y -= numberedLines.length * 14 + 5;
      index += 1;
      continue;
    }
    const paragraphLines = wrap(pdfSafe(trimmed), 88);
    paragraphLines.forEach((lineText, lineIndex) => {
      out += textCommand('F1', 9.4, BLACK, MARGIN_X, y - lineIndex * 14, lineText);
    });
    y -= paragraphLines.length * 14 + 7;
    index += 1;
  }

  out += rect([1, 1, 1], 0, 0, PAGE_WIDTH, CONTENT_BOTTOM - 4);
  out += line([0.82, 0.86, 0.86], MARGIN_X, 44, PAGE_WIDTH - MARGIN_X, 44, 0.6);
  out += drawImage('Im1', MARGIN_X, 14, 16, 16);
  out += textCommand('F1', 7.5, MID, MARGIN_X + 22, 22, 'Sankalp Platforms | Confidential proposal');
  out += textCommand('F1', 7.5, MID, PAGE_WIDTH - 75, 22, String(pageIndex + 1));
  return out;
}

const objects = [];
function addObject(value) {
  objects.push(value);
  return objects.length;
}

const fontRegular = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
const fontBold = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
const fontMono = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
const logoDim = jpegSize(logoJpeg);
const logoObject = addObject(
  `<< /Type /XObject /Subtype /Image /Width ${logoDim.width} /Height ${logoDim.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoJpeg.length} >>\nstream\n${logoJpeg.toString('latin1')}endstream`
);
const pageEntries = [];

for (let index = 0; index < pages.length; index += 1) {
  const stream = renderPage(pages[index], index);
  const content = addObject(`<< /Length ${Buffer.byteLength(stream, 'binary')} >>\nstream\n${stream}endstream`);
  pageEntries.push({ content });
}

const pagesObject = objects.length + pageEntries.length + 1;
const catalogObject = pagesObject + 1;
for (const entry of pageEntries) {
  entry.page = addObject(`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R /F3 ${fontMono} 0 R >> /XObject << /Im1 ${logoObject} 0 R >> >> /Contents ${entry.content} 0 R >>`);
}
objects.push(`<< /Type /Pages /Count ${pageEntries.length} /Kids [${pageEntries.map((entry) => `${entry.page} 0 R`).join(' ')}] >>`);
objects.push(`<< /Type /Catalog /Pages ${pagesObject} 0 R >>`);

let pdf = '%PDF-1.4\n%SankalpProposal\n';
const offsets = [0];
objects.forEach((object, index) => {
  offsets.push(Buffer.byteLength(pdf, 'binary'));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
});
const xrefOffset = Buffer.byteLength(pdf, 'binary');
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let index = 1; index < offsets.length; index += 1) {
  pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
fs.writeFileSync(outputPath, Buffer.from(pdf, 'latin1'));
console.log(`Generated ${outputPath} (${pages.length} pages)`);
