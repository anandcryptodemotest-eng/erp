"use client";

import type { ReactNode } from "react";
import { cn } from "../utils";

/** @maturity beta */
export function StockBadge({
  available,
  className,
}: {
  available: number | null | undefined;
  className?: string;
}) {
  if (available == null) return null;
  const ok = available > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-xs font-semibold",
        ok ? "bg-[var(--mist)] text-[var(--success)]" : "bg-red-50 text-[var(--danger)]",
        className
      )}
    >
      {ok ? `${available} available` : "Out of stock"}
    </span>
  );
}

/** @maturity beta */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-3", className)}>
      <h2 className="font-display text-xl font-semibold text-[var(--ink)] md:text-2xl">{title}</h2>
      {action}
    </div>
  );
}

/** @maturity beta */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "min-h-[var(--touch-min)] w-full rounded-[var(--radius-full)] border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink)] placeholder:text-[var(--ink-soft)]/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] focus-visible:ring-offset-1",
        className
      )}
      aria-label={placeholder}
    />
  );
}

/** @maturity beta */
export function CartSummary({
  itemCount,
  totalLabel,
  className,
}: {
  itemCount: number;
  totalLabel: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] px-4 py-3",
        className
      )}
    >
      <span className="text-sm text-[var(--ink-soft)]">
        {itemCount} item{itemCount === 1 ? "" : "s"}
      </span>
      <span className="text-base font-bold text-[var(--ink)]">{totalLabel}</span>
    </div>
  );
}
