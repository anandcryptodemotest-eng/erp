"use client";

import { cn } from "../utils";

/** @maturity beta — formats number or passes through preformatted label */
export function PriceDisplay({
  amount,
  className,
  size = "md",
  prefix,
}: {
  amount: string | number | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Shown before formatted amount, e.g. "From" */
  prefix?: string;
}) {
  if (amount == null || amount === "") {
    return <span className={cn("text-[var(--ink-soft)]", className)}>—</span>;
  }
  const text =
    typeof amount === "number"
      ? `₹${amount.toLocaleString("en-IN")}`
      : String(amount);
  return (
    <span
      className={cn(
        "font-bold tabular-nums text-[var(--ink)]",
        size === "sm" && "text-sm",
        size === "md" && "text-base",
        size === "lg" && "text-2xl tracking-tight",
        className
      )}
    >
      {prefix ? (
        <span className="mr-1 text-[0.7em] font-semibold text-[var(--ink-soft)]">
          {prefix}
        </span>
      ) : null}
      <span className="text-[var(--amber)]">{text}</span>
    </span>
  );
}
