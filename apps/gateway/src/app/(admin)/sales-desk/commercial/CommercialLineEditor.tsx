"use client";

import type { ReactNode } from "react";

/**
 * Shared commercial document line model (SREQ / SO now; Quote / PO / Return / Transfer later).
 * Owns line identity + qty + money fields — not document status, convert, or workflow.
 */
export type CommercialLine = {
  key: string;
  id?: string;
  productId: string;
  productName: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  /** Display / stock UOM when known */
  uom?: string | null;
  discount?: number | null;
  taxRate?: number | null;
  pricingMeta?: Record<string, unknown> | null;
  customSnapshot?: Record<string, unknown> | null;
};

export type CommercialLineEditorProps = {
  lines: CommercialLine[];
  readOnly?: boolean;
  onQuantityChange?: (key: string, quantity: number) => void;
  onUnitPriceChange?: (key: string, unitPrice: number) => void;
  onRemove?: (key: string) => void;
  /** Optional trailing cell per row (e.g. stock hints) */
  rowExtra?: (line: CommercialLine) => ReactNode;
  emptyLabel?: string;
};

function money(n: number) {
  return `₹${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Presentational commercial lines table — domain pages supply handlers. */
export function CommercialLineEditor({
  lines,
  readOnly,
  onQuantityChange,
  onUnitPriceChange,
  onRemove,
  rowExtra,
  emptyLabel = "No lines",
}: CommercialLineEditorProps) {
  if (lines.length === 0) {
    return <p className="text-sm text-[var(--ink-soft)]">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--mist)] text-left text-xs uppercase tracking-wide text-[var(--ink-soft)]">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Product</th>
            <th className="px-3 py-2.5 font-semibold">Qty</th>
            <th className="px-3 py-2.5 font-semibold">UOM</th>
            <th className="px-3 py-2.5 font-semibold">Unit price</th>
            <th className="px-3 py-2.5 font-semibold">Tax %</th>
            <th className="px-3 py-2.5 font-semibold">Ext.</th>
            {(rowExtra || onRemove) && <th className="px-3 py-2.5" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {lines.map((line) => {
            const ext = line.quantity * line.unitPrice;
            return (
              <tr key={line.key}>
                <td className="px-3 py-2.5 font-medium text-[var(--ink)]">{line.productName}</td>
                <td className="px-3 py-2.5">
                  {readOnly || !onQuantityChange ? (
                    <span className="tabular-nums">{line.quantity}</span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="w-20 rounded-lg border border-[var(--line)] px-2 py-1 tabular-nums"
                      value={line.quantity}
                      onChange={(e) => onQuantityChange(line.key, Number(e.target.value))}
                      aria-label={`Quantity for ${line.productName}`}
                    />
                  )}
                </td>
                <td className="px-3 py-2.5 text-[var(--ink-soft)]">{line.uom ?? "—"}</td>
                <td className="px-3 py-2.5">
                  {readOnly || !onUnitPriceChange ? (
                    <span className="tabular-nums">{money(line.unitPrice)}</span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="w-28 rounded-lg border border-[var(--line)] px-2 py-1 tabular-nums"
                      value={line.unitPrice}
                      onChange={(e) => onUnitPriceChange(line.key, Number(e.target.value))}
                      aria-label={`Unit price for ${line.productName}`}
                    />
                  )}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-[var(--ink-soft)]">
                  {line.taxRate != null ? line.taxRate : "—"}
                </td>
                <td className="px-3 py-2.5 tabular-nums font-medium">{money(ext)}</td>
                {(rowExtra || onRemove) && (
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      {rowExtra?.(line)}
                      {!readOnly && onRemove ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-[var(--ink-soft)] hover:text-[var(--danger)]"
                          onClick={() => onRemove(line.key)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
