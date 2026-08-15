import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TAX_INVOICE_SEED } from "./seed-tax-invoice";
import { blankDocumentDefinition } from "./blank-document";
import { renderDocument, renderDocumentHtml, renderDocumentPdfBytes } from "./render";
import { pdfSafeText } from "./pdf";
import { formatValue, getByPath } from "./resolve";

const SAMPLE_PAYLOAD = {
  invoice: {
    number: "INV-000001",
    date: "2026-08-03",
    notes: "Site delivery before noon",
    placeOfSupplyLabel: "Place of Supply: 29",
  },
  seller: {
    name: "Trust Wood",
    address: "Yard 1",
    gstin: "29AAAAA0000A1Z5",
    gstinMeta: "GSTIN: 29AAAAA0000A1Z5 | State: 29",
    cityState: "State 29",
    gstinLine: "GSTIN: 29AAAAA0000A1Z5",
    stateLine: "State: 29",
    signatoryFor: "For Trust Wood",
  },
  buyer: {
    name: "Buyer Co",
    address: "City",
    gstin: "",
    gstinLine: "",
    stateLine: "State: 29",
  },
  lines: [{ sku: "TW-1", description: "BWP", qty: 2, rate: 100, tax: 36, amount: 236 }],
  totals: { subtotal: 200, tax: 36, total: 236 },
};

/** Parse inline `top:Npx` from the first element with data-id="<id>". */
function topOf(html: string, dataId: string): number {
  const re = new RegExp(`data-id="${dataId}"[^>]*style="[^"]*top:(\\d+(?:\\.\\d+)?)px`);
  const m = re.exec(html);
  if (!m) {
    const re2 = new RegExp(
      `style="[^"]*top:(\\d+(?:\\.\\d+)?)px[^"]*"[^>]*data-id="${dataId}"`
    );
    const m2 = re2.exec(html);
    if (!m2) throw new Error(`topOf: no element data-id=${dataId}`);
    return Number(m2[1]);
  }
  return Number(m[1]);
}

test("getByPath and formatValue", () => {
  const payload = { invoice: { number: "INV-1", total: 100.5 }, lines: [{ sku: "A" }] };
  assert.equal(getByPath(payload, "invoice.number"), "INV-1");
  assert.equal(formatValue(100.5, "currency"), "Rs. 100.50");
});

test("pdfSafeText maps rupee to Rs. so Helvetica does not paint tofu", () => {
  assert.equal(pdfSafeText("₹1,850.00"), "Rs.1,850.00");
  assert.equal(pdfSafeText("Rs. 100.50"), "Rs. 100.50");
});

test("numberToIndianWords and formatWords casing", async () => {
  const { numberToIndianWords, formatWords, listFormatters } = await import("./formatters");
  assert.equal(numberToIndianWords(12390), "Twelve Thousand Three Hundred Ninety");
  assert.equal(
    formatWords(12390),
    "Rupees Twelve Thousand Three Hundred Ninety Only"
  );
  assert.equal(
    formatWords(12390.5),
    "Rupees Twelve Thousand Three Hundred Ninety and Fifty Paise Only"
  );
  assert.equal(formatValue(236, "words"), "Rupees Two Hundred Thirty Six Only");
  assert.ok(listFormatters().some((f) => f.id === "words"));
});

test("renderDocumentHtml includes title and line", () => {
  const html = renderDocumentHtml(TAX_INVOICE_SEED, SAMPLE_PAYLOAD);
  assert.match(html, /TAX INVOICE/);
  assert.match(html, /INV-000001/);
  assert.match(html, /BWP/);
  assert.match(html, /AMOUNT IN WORDS/);
  assert.match(html, /Rupees Two Hundred Thirty Six Only/);
  assert.match(html, /BILL FROM/);
  assert.match(html, /Authorized Signatory/);
  assert.match(html, /background:#173f5f/);
});

test("blank document is an empty page, not the tax invoice seed", () => {
  const d = blankDocumentDefinition({ id: "doc-1", name: "Untitled" });
  assert.equal(d.items.length, 0);
  assert.equal(d.studio?.level, "business");
  assert.equal(d.name, "Untitled");
});

test("renderer ignores studio chrome — same HTML when level/tab/step change", () => {
  const withStudio = {
    ...TAX_INVOICE_SEED,
    studio: { level: "developer" as const, tab: "preview" as const, step: 6, mode: "guided" as const },
  };
  const a = renderDocumentHtml(TAX_INVOICE_SEED, SAMPLE_PAYLOAD);
  const b = renderDocumentHtml(withStudio, SAMPLE_PAYLOAD);
  assert.equal(a, b);
});

test("widget definition expands in HTML preview (logo + lines, no Widget leftover)", () => {
  const def = {
    ...TAX_INVOICE_SEED,
    name: "Widget invoice",
    items: [
      {
        id: "w_logo",
        name: "Logo",
        type: "Widget" as const,
        widgetId: "doc.logo",
        widgetConfig: {},
        placement: { x: 0, y: 0, width: 120, height: 48 },
        rotation: 0,
        locked: false,
        visible: true,
        zIndex: 0,
        opacity: 1,
      },
      {
        id: "w_lines",
        name: "Line items",
        type: "Widget" as const,
        widgetId: "doc.lineItems",
        widgetConfig: {},
        placement: { x: 0, y: 80, width: 515, height: 120 },
        rotation: 0,
        locked: false,
        visible: true,
        zIndex: 0,
        opacity: 1,
      },
    ],
  };
  const html = renderDocumentHtml(def, SAMPLE_PAYLOAD);
  assert.match(html, /BWP/);
  assert.match(html, /SKU/);
  assert.doesNotMatch(html, /type":"Widget"/);
});

test("HTML container children use local coords — seller above table, no double offset", () => {
  const html = renderDocumentHtml(TAX_INVOICE_SEED, SAMPLE_PAYLOAD);
  const sellerTop = topOf(html, "seller");
  const buyerTop = topOf(html, "buyer");
  const linesTop = topOf(html, "lines");
  const sellerLabelTop = topOf(html, "sellerLabel");

  assert.ok(sellerTop < linesTop, `seller (${sellerTop}) must be above lines (${linesTop})`);
  assert.ok(buyerTop < linesTop, `buyer (${buyerTop}) must be above lines (${linesTop})`);
  // sellerLabel is local to Bill From container (y=8 padding), not page-double-offset
  assert.equal(sellerLabelTop, 8, "sellerLabel must be local y inside seller container");
});

test("HTML table does not stretch to placement height", () => {
  const html = renderDocumentHtml(TAX_INVOICE_SEED, SAMPLE_PAYLOAD);
  const m = /data-id="lines"[^>]*/.exec(html);
  assert.ok(m, "lines table missing");
  assert.doesNotMatch(m[0], /height:280px/);
  assert.match(html, />Subtotal</);
  assert.match(html, />TOTAL</);
});

test("renderDocumentPdfBytes is a PDF", async () => {
  const buf = await renderDocumentPdfBytes(TAX_INVOICE_SEED, SAMPLE_PAYLOAD);
  assert.equal(buf.subarray(0, 4).toString(), "%PDF");
  assert.equal(buf.includes(Buffer.from([0xe2, 0x82, 0xb9])), false);
  assert.ok(buf.includes(Buffer.from("Rs.")));
});

test("renderDocument writes PDF", async () => {
  const dir = await mkdtemp(join(tmpdir(), "erp-doc-"));
  const out = join(dir, "inv.pdf");
  const result = await renderDocument({
    assetRef: { type: "DOCUMENT", id: "tax-invoice", version: 1 },
    definition: TAX_INVOICE_SEED,
    payload: {
      invoice: { number: "INV-1", date: "2026-08-03" },
      seller: { name: "Trust Wood" },
      buyer: { name: "Buyer" },
      lines: [{ sku: "A", description: "Item", qty: 1, rate: 10, tax: 0, amount: 10 }],
      totals: { subtotal: 10, tax: 0, total: 10 },
    },
    outputPath: out,
    publicUrl: "/api/invoices/x/pdf",
  });
  assert.equal(result.mimeType, "application/pdf");
  assert.equal(result.checksum.length, 64);
  const buf = await readFile(out);
  assert.ok(buf.toString("utf8", 0, 5) === "%PDF-");
  const text = buf.toString("latin1");
  assert.match(text, /\(Buyer\) Tj/);
  assert.match(text, /\(Item\) Tj/);
});
