"use client";

import type { ReactNode } from "react";
import { cn } from "../utils";

export type MetricTileProps = {
  value: ReactNode;
  label: string;
  className?: string;
  tone?: "default" | "success" | "warning" | "muted";
};

export function MetricTile({ value, label, className, tone = "default" }: MetricTileProps) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-3 text-center shadow-[var(--shadow-sm)]",
        tone === "default" && "border-[var(--line)] bg-[var(--surface-raised)]",
        tone === "success" && "border-emerald-200 bg-emerald-50/90",
        tone === "warning" && "border-amber-200 bg-amber-50/90",
        tone === "muted" && "border-[var(--line)] bg-[var(--mist)]",
        className
      )}
    >
      <div
        className={cn(
          "text-xl font-semibold tabular-nums leading-none tracking-tight",
          tone === "success" && "text-emerald-800",
          tone === "warning" && "text-amber-900",
          tone === "default" && "text-[var(--ink)]",
          tone === "muted" && "text-[var(--ink-soft)]"
        )}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
        {label}
      </div>
    </div>
  );
}
