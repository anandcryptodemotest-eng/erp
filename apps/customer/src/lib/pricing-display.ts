/** Shared helpers to present quotes / cart lines for any pricing basis. */

export type QuoteLike = {
  unitPrice?: number;
  lineTotal?: number;
  pricingUom?: string;
  basis?: string;
  commercialQuantity?: number;
  resolvedQuantity?: number;
  rate?: { amount: number; per: string; source?: string };
  measure?: {
    area?: number | null;
    weight?: number | null;
    volume?: number | null;
    length?: number | null;
    width?: number | null;
    uom?: string;
  };
  breakdown?: { code: string; label: string; quantity?: number; unit?: string; amount: number }[];
};

export type BillRow = { label: string; value: string; muted?: boolean; emphasize?: boolean };

function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("en-IN", { maximumFractionDigits: 4 });
}

/** Human measure from quote (area / weight / volume). */
export function measureFromQuote(q: QuoteLike | null | undefined): {
  quantity: number;
  uom: string;
  label: string;
} | null {
  if (!q?.measure) return null;
  const m = q.measure;
  if (m.area != null && m.area > 0) {
    return { quantity: m.area, uom: m.uom || q.pricingUom || "sq_ft", label: "Area" };
  }
  if (m.weight != null && m.weight > 0) {
    return { quantity: m.weight, uom: m.uom || "kg", label: "Weight" };
  }
  if (m.volume != null && m.volume > 0) {
    return { quantity: m.volume, uom: m.uom || "m3", label: "Volume" };
  }
  return null;
}

export function quoteFormula(q: QuoteLike | null | undefined): string | null {
  if (!q?.rate) return null;
  const measure = measureFromQuote(q);
  if (!measure) return null;
  const dims =
    q.measure?.length != null && q.measure?.width != null
      ? ` (${fmtQty(q.measure.length)} × ${fmtQty(q.measure.width)})`
      : "";
  return `${fmtQty(measure.quantity)} ${measure.uom}${dims} × ${inr(q.rate.amount)}/${q.rate.per}`;
}

/** Bill rows for a single product quote (PDP / configure). */
export function billRowsFromQuote(q: QuoteLike, qty: number): BillRow[] {
  const rows: BillRow[] = [];
  const measure = measureFromQuote(q);
  const basis = q.basis || "PER_EACH";

  if (q.rate && measure) {
    rows.push({
      label: `Rate`,
      value: `${inr(q.rate.amount)} / ${q.rate.per}`,
    });
    rows.push({
      label: `${measure.label} / unit`,
      value: `${fmtQty(measure.quantity)} ${measure.uom}`,
    });
    if (q.unitPrice != null) {
      rows.push({
        label: "Price / unit",
        value: inr(q.unitPrice),
        emphasize: true,
      });
    }
  } else if (q.unitPrice != null) {
    rows.push({
      label: basis === "PER_EACH" ? "Price / unit" : "Unit price",
      value: inr(q.unitPrice),
      emphasize: true,
    });
  }

  rows.push({ label: "Quantity", value: String(qty) });

  if (measure && qty > 0) {
    rows.push({
      label: `Total ${measure.uom}`,
      value: `${fmtQty(measure.quantity * qty)} ${measure.uom}`,
      muted: true,
    });
  } else if (q.resolvedQuantity != null && basis !== "PER_EACH") {
    rows.push({
      label: "Resolved qty",
      value: `${fmtQty(q.resolvedQuantity)} ${q.pricingUom || ""}`.trim(),
      muted: true,
    });
  }

  return rows;
}

export function cartBillLinesFromQuote(q: QuoteLike, qty: number): { label: string; value: string }[] {
  return billRowsFromQuote(q, qty).map(({ label, value }) => ({ label, value }));
}
