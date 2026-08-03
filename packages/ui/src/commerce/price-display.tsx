"use client";

import { cn } from "../utils";

/** @maturity beta — formats number or passes through preformatted label */
export function PriceDisplay({
  amount,
  className,
  size = "md",
}: {
  amount: string | number | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
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
        "font-bold tabular-nums text-[var(--amber)]",
        size === "sm" && "text-sm",
        size === "md" && "text-base",
        size === "lg" && "text-2xl",
        className
      )}
    >
      {text}
    </span>
  );
}
