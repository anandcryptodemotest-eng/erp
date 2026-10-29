"use client";

import { cn } from "../utils";

/** @maturity beta */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  /** Increment per +/- press. Use a fraction (e.g. 0.25) for sell-by-weight items. */
  step = 1,
  /** Unit suffix shown next to the value, e.g. "kg". */
  unit,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
}) {
  function set(n: number) {
    let next = n;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    // Avoid floating-point drift from repeated fractional steps (e.g. 0.1 + 0.2).
    const decimals = (String(step).split(".")[1] ?? "").length;
    if (decimals > 0) next = Number(next.toFixed(decimals));
    onChange(next);
  }
  // Show whole numbers plainly and fractional quantities at the step's precision
  // (e.g. step 0.25 → "0.25 kg"), trimming any trailing zeros.
  const stepDecimals = (String(step).split(".")[1] ?? "").length;
  const display = Number.isInteger(value)
    ? String(value)
    : Number(value.toFixed(stepDecimals)).toString();
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)] border border-[var(--line)] bg-[var(--surface-raised)]",
        className
      )}
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        className="flex h-[var(--touch-min)] w-[var(--touch-min)] items-center justify-center text-lg font-semibold text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] rounded-l-[var(--radius-full)]"
        onClick={() => set(value - step)}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="min-w-10 text-center text-sm font-bold tabular-nums">
        {display}
        {unit ? <span className="ml-0.5 text-xs font-medium text-[var(--ink-soft)]">{unit}</span> : null}
      </span>
      <button
        type="button"
        className="flex h-[var(--touch-min)] w-[var(--touch-min)] items-center justify-center text-lg font-semibold text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] rounded-r-[var(--radius-full)]"
        onClick={() => set(value + step)}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
