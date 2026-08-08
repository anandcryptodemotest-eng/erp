import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TAX_INVOICE_SEED } from "./seed-tax-invoice";
import { renderDocument, renderDocumentHtml } from "./render";
import { formatValue, getByPath } from "./resolve";

const SAMPLE_PAYLOAD = {
  invoice: { number: "INV-000001", date: "2026-08-03" },
  seller: { name: "Trust Wood", address: "Yard 1", gstin: "29AAAAA0000A1Z5" },
  buyer: { name: "Buyer Co", address: "City", gstin: "" },
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
  assert.equal(formatValue(100.5, "currency").includes("100.50"), true);
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
  assert.match(html, /Amount in words:/);
  assert.match(html, /Rupees Two Hundred Thirty Six Only/);
});

test("HTML container children use local coords — seller above table, no double offset", () => {
  const html = renderDocumentHtml(TAX_INVOICE_SEED, SAMPLE_PAYLOAD);
  const sellerTop = topOf(html, "seller");
  const buyerTop = topOf(html, "buyer");
  const linesTop = topOf(html, "lines");
  const sellerLabelTop = topOf(html, "sellerLabel");

  assert.ok(sellerTop < linesTop, `seller (${sellerTop}) must be above lines (${linesTop})`);
  assert.ok(buyerTop < linesTop, `buyer (${buyerTop}) must be above lines (${linesTop})`);
  // sellerLabel.placement.y === 0 → local top inside container wrapper
  assert.equal(sellerLabelTop, 0, "sellerLabel must be local y=0, not page-double-offset");
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
