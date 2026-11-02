"use client";

import type { ReactNode } from "react";
import { cn } from "../utils";
import { PriceDisplay } from "./price-display";

export type BillRow = {
  label: string;
  value: string;
  muted?: boolean;
  emphasize?: boolean;
};

/** @maturity beta — generic line/cart bill summary (works for any pricing basis) */
export function BillSummary({
  title = "Bill summary",
  rows,
  totalLabel = "Total",
  totalValue,
  footer,
  className,
}: {
  title?: string;
  rows: BillRow[];
  totalLabel?: string;
  totalValue: string | number;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]",
        className
      )}
    >
      <div className="border-b border-[var(--line)] bg-[var(--surface-sunken)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
        {title}
      </div>
      <div className="divide-y divide-[var(--line)] px-3 py-1">
        {rows.map((row, i) => (
          <div
            key={`${row.label}-${i}`}
            className={cn(
              "flex items-start justify-between gap-3 py-2 text-sm",
              row.muted && "text-[var(--ink-soft)]",
              row.emphasize && "font-semibold text-[var(--ink)]"
            )}
          >
            <span className={cn(!row.emphasize && "text-[var(--ink-soft)]")}>
              {row.label}
            </span>
            <span className="text-right tabular-nums text-[var(--ink)]">{row.value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface-sunken)] px-3 py-3">
        <span className="text-sm font-bold text-[var(--ink)]">{totalLabel}</span>
        <PriceDisplay
          amount={typeof totalValue === "number" ? totalValue : totalValue}
          size="md"
        />
      </div>
      {footer ? (
        <div className="border-t border-[#f0f0f0] px-3 py-2 text-xs text-[var(--ink-soft)]">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** @maturity beta — compact rate + measure headline above the bill */
export function PriceQuoteHeader({
  rateAmount,
  rateUom,
  unitPrice,
  unitLabel = "per unit",
  formula,
  className,
}: {
  rateAmount?: number | null;
  rateUom?: string | null;
  unitPrice?: number | null;
  unitLabel?: string;
  formula?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {rateAmount != null && rateUom ? (
        <div className="flex flex-wrap items-baseline gap-1.5">
          <PriceDisplay amount={rateAmount} size="lg" />
          <span className="text-sm font-semibold text-[var(--ink-soft)]">
            / {rateUom}
          </span>
        </div>
      ) : unitPrice != null ? (
        <div className="flex flex-wrap items-baseline gap-1.5">
          <PriceDisplay amount={unitPrice} size="lg" />
          <span className="text-sm font-semibold text-[var(--ink-soft)]">
            {unitLabel}
          </span>
        </div>
      ) : null}
      {formula ? (
        <p className="text-sm text-[var(--ink-soft)]">{formula}</p>
      ) : null}
      {rateAmount != null && rateUom && unitPrice != null ? (
        <p className="text-sm font-semibold text-[var(--ink)]">
          = <PriceDisplay amount={unitPrice} size="sm" /> {unitLabel}
        </p>
      ) : null}
    </div>
  );
}
