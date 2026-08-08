/** Extensible formatter registry — Studio UI uses listFormatters(); renderer uses formatValue(). */

export type FormatterId = string;

export interface Formatter {
  id: FormatterId;
  label: string;
  format(value: unknown, options?: unknown): string;
}

const registry = new Map<string, Formatter>();

export function registerFormatter(formatter: Formatter): void {
  registry.set(formatter.id, formatter);
}

export function getFormatter(id: string): Formatter | undefined {
  return registry.get(id);
}

export function listFormatters(): Formatter[] {
  return Array.from(registry.values());
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** Convert 0–99 to title-case words. */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? TENS[t]! : `${TENS[t]} ${ONES[o]}`;
}

/** Convert 0–999 to title-case words. */
function threeDigits(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(`${ONES[h]} Hundred`);
  if (rest > 0) parts.push(twoDigits(rest));
  return parts.join(" ");
}

/**
 * Indian numbering: crore / lakh / thousand / hundred.
 * Pure — independently unit-tested.
 */
export function numberToIndianWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  const whole = Math.floor(Math.abs(n));
  if (whole === 0) return "Zero";

  const crore = Math.floor(whole / 10_000_000);
  const lakh = Math.floor((whole % 10_000_000) / 100_000);
  const thousand = Math.floor((whole % 100_000) / 1000);
  const hundred = whole % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred > 0) parts.push(threeDigits(hundred));
  return parts.join(" ");
}

/**
 * Standardized amount-in-words:
 * - Rupees Twelve Thousand Three Hundred Ninety Only
 * - Rupees Twelve Thousand Three Hundred Ninety and Fifty Paise Only
 */
export function formatWords(value: unknown, _options?: unknown): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "";
  const abs = Math.abs(n);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100) % 100;
  const rupeeWords = numberToIndianWords(rupees);
  if (paise === 0) {
    return `Rupees ${rupeeWords} Only`;
  }
  const paiseWords = numberToIndianWords(paise);
  return `Rupees ${rupeeWords} and ${paiseWords} Paise Only`;
}

function formatCurrency(value: unknown, _options?: unknown): string {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? "");
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: unknown, _options?: unknown): string {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value ?? "");
  return d.toLocaleDateString("en-IN");
}

registerFormatter({ id: "currency", label: "Currency", format: formatCurrency });
registerFormatter({ id: "date", label: "Date", format: formatDate });
registerFormatter({ id: "words", label: "Amount in words", format: formatWords });

/** Resolve dotted path from payload; supports array index as numeric segments. */
export function getByPath(payload: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: unknown = payload;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function formatValue(value: unknown, formatterId?: string, fallback = ""): string {
  if (value == null || value === "") return fallback;
  if (!formatterId) return String(value);

  // date:legacy suffix still supported
  const id = formatterId.startsWith("date:") ? "date" : formatterId;
  const formatter = registry.get(id);
  if (formatter) {
    const out = formatter.format(value);
    return out === "" ? fallback || String(value) : out;
  }
  return String(value);
}

export function isVisible(
  item: { visibility?: { when?: string }; visible?: boolean },
  payload: Record<string, unknown>
): boolean {
  if (item.visible === false) return false;
  const when = item.visibility?.when;
  if (!when) return true;
  const v = getByPath(payload, when);
  return Boolean(v);
}
