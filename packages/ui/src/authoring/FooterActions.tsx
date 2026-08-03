"use client";

import type { ReactNode } from "react";
import { cn } from "../utils";

export type FooterActionsProps = {
  stats?: ReactNode;
  actions: ReactNode;
  className?: string;
};

export function FooterActions({ stats, actions, className }: FooterActionsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--ink-soft)]">
        {stats}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export type FooterStatProps = {
  label: string;
  value: ReactNode;
};

export function FooterStat({ label, value }: FooterStatProps) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-medium text-[var(--ink-soft)]">{label}</span>
      <span className="font-semibold text-[var(--ink)]">{value}</span>
    </span>
  );
}
