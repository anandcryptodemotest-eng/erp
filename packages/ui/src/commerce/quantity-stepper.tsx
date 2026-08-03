"use client";

import { cn } from "../utils";

/** @maturity beta */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  function set(n: number) {
    let next = n;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    onChange(next);
  }
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)] border border-[var(--line)] bg-white",
        className
      )}
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        className="flex h-[var(--touch-min)] w-[var(--touch-min)] items-center justify-center text-lg font-semibold text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] rounded-l-[var(--radius-full)]"
        onClick={() => set(value - 1)}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="min-w-10 text-center text-sm font-bold tabular-nums">{value}</span>
      <button
        type="button"
        className="flex h-[var(--touch-min)] w-[var(--touch-min)] items-center justify-center text-lg font-semibold text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] rounded-r-[var(--radius-full)]"
        onClick={() => set(value + 1)}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
