"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils";
import "./chip.css";

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
      className={cn("erp-chip", active && "is-active", className)}
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
    <div className={cn("space-y-1.5", className)}>
      {label ? <div className="erp-chip-group-label">{label}</div> : null}
      <div className="erp-chip-group-options" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
