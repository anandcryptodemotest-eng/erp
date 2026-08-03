"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils";

/** @maturity beta */
export function Chip({
  active,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-[var(--touch-min)] items-center rounded-[var(--radius-full)] border px-4 text-sm font-semibold transition-[background,border-color,color] duration-[var(--motion-fast)]",
        active
          ? "border-[var(--ink)] bg-[var(--ink)] text-white"
          : "border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--forest-mid)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] focus-visible:ring-offset-2",
        className
      )}
      aria-pressed={active}
      {...props}
    >
      {children}
    </button>
  );
}

/** @maturity beta */
export function ChipGroup({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {label ? <div className="text-sm font-semibold text-[var(--ink)]">{label}</div> : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
