/**
 * Dashboard chart / status-bar deep-link builders (BL-041 / BL-043).
 * Widgets must not invent URLs.
 */

const DESK = "/admin/sales-desk";
const AR = "/admin/ar";
const INVOICES = "/admin/invoices";
const PRODUCTS = "/admin/products";

function qs(params: Record<string, string | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && String(v).trim() !== "") sp.set(k, String(v).trim());
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function normStatus(status: string): string {
  return String(status ?? "")
    .trim()
    .replaceAll(" ", "_")
    .toUpperCase();
}

/** Normalize a calendar day to YYYY-MM-DD for Desk from/to. */
export function toDayParam(isoOrDate: string): string {
  const raw = String(isoOrDate).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Click a revenue/sales trend day → Order Desk filtered to that day.
 */
export function buildRevenueTrendHref(range: { from: string; to?: string }): string {
  const from = toDayParam(range.from);
  const to = toDayParam(range.to ?? range.from);
  return `${DESK}${qs({ from, to, tab: "inflight" })}`;
}

/**
 * Click an order-status segment → Desk inflight with status filter.
 */
export function buildOrderStatusHref(status: string): string {
  const key = normStatus(status);
  if (key === "IN_FLIGHT" || key === "INFLIGHT") {
    return `${DESK}${qs({ tab: "inflight", status: "inflight" })}`;
  }
  if (!key) {
    return `${DESK}${qs({ tab: "inflight" })}`;
  }
  return `${DESK}${qs({ tab: "inflight", status: key })}`;
}

/** My Tasks status bar → Desk My Work filtered by task status. */
export function buildMyTasksStatusHref(status?: string | null): string {
  const key = normStatus(status ?? "");
  if (!key) return `${DESK}${qs({ tab: "tasks" })}`;
  return `${DESK}${qs({ tab: "tasks", taskStatus: key })}`;
}

/** SREQ status bar → Desk inbox filtered by request status. */
export function buildSreqStatusHref(status?: string | null): string {
  const key = normStatus(status ?? "");
  if (!key) return `${DESK}${qs({ tab: "sreq" })}`;
  return `${DESK}${qs({ tab: "sreq", sreqStatus: key })}`;
}

/**
 * Click outstanding / ageing bucket → AR workbench.
 */
export function buildOutstandingInvoiceHref(bucket: string = "all"): string {
  const raw = String(bucket ?? "all").trim().toLowerCase();
  if (!raw || raw === "all" || raw === "outstanding") {
    return AR;
  }
  const normalized =
    raw === "90+" || raw === "d90+" || raw === "90_plus" ? "d90_plus" : raw.replaceAll("-", "_");
  return `${AR}${qs({ bucket: normalized })}`;
}

/** Click top-products bar → products list (or detail when id known). */
export function buildTopProductsHref(productId?: string | null): string {
  const id = productId?.trim();
  if (id) return `${PRODUCTS}${qs({ id })}`;
  return PRODUCTS;
}

/** Optional invoices list filter for outstanding count rows. */
export function buildInvoicesOutstandingHref(): string {
  return `${INVOICES}${qs({ status: "outstanding" })}`;
}

export type StatusCount = { status: string; count: number };

/** Aggregate rows by status (stable sort: higher count first, then name). */
export function countByStatus(
  rows: Array<{ status?: string | null }>,
  opts?: { exclude?: string[] }
): StatusCount[] {
  const exclude = new Set((opts?.exclude ?? []).map((s) => normStatus(s)));
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = normStatus(row.status ?? "");
    if (!key || exclude.has(key)) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}

export function formatStatusLabel(status: string): string {
  return String(status ?? "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Counts with meaningful variation only (count > 0). */
export function positiveStatusCounts(counts: StatusCount[]): StatusCount[] {
  return counts.filter((c) => c.count > 0);
}

/**
 * My Tasks visualization mode (BL-044).
 * Don't visualize when there's no meaningful variation.
 */
export type TaskVizMode = "empty" | "single" | "multi";

export function taskVizMode(counts: StatusCount[]): TaskVizMode {
  const positive = positiveStatusCounts(counts);
  if (positive.length === 0) return "empty";
  if (positive.length === 1) return "single";
  return "multi";
}

/** Revenue trend session ranges (BL-042/044) — never persisted to DashboardPreference. */
export type RevenueTrendRange = "7D" | "30D" | "MTD" | "QTD";

export const REVENUE_TREND_RANGES: RevenueTrendRange[] = ["7D", "30D", "MTD", "QTD"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** ISO bounds for `/api/reports/sales?from=&to=` (UTC day edges). */
export function revenueTrendRangeBounds(
  range: RevenueTrendRange,
  now: Date = new Date()
): { from: string; to: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const day = now.getUTCDate();
  const toDay = ymdUTC(new Date(Date.UTC(y, m, day)));
  const to = `${toDay}T23:59:59.999Z`;

  if (range === "7D") {
    const fromDay = ymdUTC(new Date(Date.UTC(y, m, day - 6)));
    return { from: `${fromDay}T00:00:00.000Z`, to };
  }
  if (range === "30D") {
    const fromDay = ymdUTC(new Date(Date.UTC(y, m, day - 29)));
    return { from: `${fromDay}T00:00:00.000Z`, to };
  }
  if (range === "MTD") {
    const fromDay = ymdUTC(new Date(Date.UTC(y, m, 1)));
    return { from: `${fromDay}T00:00:00.000Z`, to };
  }
  const qStart = Math.floor(m / 3) * 3;
  const fromDay = ymdUTC(new Date(Date.UTC(y, qStart, 1)));
  return { from: `${fromDay}T00:00:00.000Z`, to };
}
