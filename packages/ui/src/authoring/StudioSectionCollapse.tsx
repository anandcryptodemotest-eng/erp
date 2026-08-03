"use client";

import type { ReactNode } from "react";
import { cn } from "../utils";

export type StudioSectionCollapseProps = {
  title: string;
  summary?: ReactNode;
  badge?: ReactNode;
  done?: boolean;
  onExpand: () => void;
  className?: string;
};

/** Collapsed accordion row for inactive studio sections. */
export function StudioSectionCollapse({
  title,
  summary,
  badge,
  done,
  onExpand,
  className,
}: StudioSectionCollapseProps) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3.5 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-[color-mix(in_srgb,var(--brand)_35%,var(--line))] hover:bg-[var(--mist)]/40",
        className
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
          done
            ? "bg-[var(--brand)] text-white"
            : "border border-[var(--line)] bg-[var(--mist)] text-[var(--ink-soft)]"
        )}
      >
        {done ? "✓" : "○"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--ink)]">{title}</span>
        {summary ? (
          <span className="mt-0.5 block text-xs text-[var(--ink-soft)] leading-snug line-clamp-2">
            {summary}
          </span>
        ) : null}
      </span>
      {badge ? <span className="shrink-0">{badge}</span> : null}
      <span className="shrink-0 text-[var(--ink-soft)] text-lg leading-none" aria-hidden>
        ›
      </span>
    </button>
  );
}
