"use client";

import { cn } from "../utils";

/** @maturity beta — prefer preformatted labels from formatPortalPrice; never show ₹0 */
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
  if (typeof amount === "number") {
    if (!Number.isFinite(amount) || amount <= 0) {
      return (
        <span className={cn("font-semibold text-[var(--ink-soft)]", size === "sm" && "text-sm", className)}>
          Price on request
        </span>
      );
    }
  }
  const text =
    typeof amount === "number"
      ? `₹${amount.toLocaleString("en-IN")}`
      : String(amount);
  if (/^₹\s*0(\.0+)?$/i.test(text.trim()) || text.trim() === "₹0") {
    return (
      <span className={cn("font-semibold text-[var(--ink-soft)]", size === "sm" && "text-sm", className)}>
        Price on request
      </span>
    );
  }
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
