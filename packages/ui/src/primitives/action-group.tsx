"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../utils";

export type ActionGroupProps = HTMLAttributes<HTMLDivElement> & {
  /** Accessible name for the group (e.g. "Row actions"). */
  "aria-label": string;
  children: ReactNode;
};

/**
 * Semantic cluster for row-level icon actions (Edit / Delete / …).
 * Gap uses `--space-2`; no chrome — borders/backgrounds only if a future use case needs them.
 *
 * Overflow rule (ERP action language): if a row would expose more than 3 icon actions,
 * keep ≤3 primary and move the rest into an OverflowMenu (⋯). Not implemented here yet.
 */
export function ActionGroup({
  "aria-label": ariaLabel,
  className,
  children,
  style,
  ...props
}: ActionGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center", className)}
      style={{ gap: "var(--space-2)", ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
