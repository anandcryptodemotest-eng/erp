"use client";

import type { ReactNode } from "react";
import { cn } from "../utils";

export type SummaryCardProps = {
  label: string;
  value: ReactNode;
  className?: string;
};

export function SummaryCard({ label, value, className }: SummaryCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 shadow-[var(--shadow-sm)]",
        className
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--ink)] leading-snug break-words">{value}</div>
    </div>
  );
}

export type WarningItem = {
  id: string;
  message: string;
  tone?: "warn" | "error";
};

export type SummaryKvRow = { label: string; value: ReactNode };

export type ProductSummaryBlockProps = {
  title?: string;
  rows: SummaryKvRow[];
  className?: string;
};

export function ProductSummaryBlock({ title = "Product Summary", rows, className }: ProductSummaryBlockProps) {
  return (
    <div className={cn("rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] overflow-hidden", className)}>
      <div className="border-b border-[var(--line)] bg-[var(--mist)]/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
        {title}
      </div>
      <dl className="divide-y divide-[var(--line)]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-3 px-3 py-2.5">
            <dt className="text-xs text-[var(--ink-soft)] shrink-0">{r.label}</dt>
            <dd className="text-xs font-semibold text-[var(--ink)] text-right break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export type VariantPreviewItem = {
  id: string;
  label: string;
  status?: "willCreate" | "alreadyExists" | "invalid";
};

export type VariantPreviewGridProps = {
  title?: string;
  items: VariantPreviewItem[];
  emptyText?: string;
  className?: string;
};

export function VariantPreviewGrid({
  title = "Variants Preview",
  items,
  emptyText = "Select configuration to preview variants",
  className,
}: VariantPreviewGridProps) {
  return (
    <div className={cn("rounded-xl border border-[var(--line)] bg-[var(--mist)]/30 p-3", className)}>
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)] mb-2">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--ink-soft)] py-3 text-center">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {items.slice(0, 24).map((item) => (
            <span
              key={item.id}
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium",
                item.status === "invalid" && "border-amber-200 bg-amber-50 text-amber-900",
                item.status === "alreadyExists" && "border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-soft)]",
                (!item.status || item.status === "willCreate") &&
                  "border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink)]"
              )}
              title={item.status}
            >
              {item.label}
            </span>
          ))}
          {items.length > 24 ? (
            <span className="text-[11px] text-[var(--ink-soft)] self-center">+{items.length - 24} more</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export type MediaPreviewBlockProps = {
  title?: string;
  images?: string[];
  emptyText?: string;
  className?: string;
};

export function MediaPreviewBlock({
  title = "Media",
  images = [],
  emptyText = "Add images in Commercial step",
  className,
}: MediaPreviewBlockProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-[var(--line)] bg-[var(--mist)]/20 p-3",
        className
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)] mb-2">{title}</div>
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
          <span className="text-2xl text-[var(--ink-soft)]/50 font-light">▣</span>
          <p className="text-xs text-[var(--ink-soft)]">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {images.slice(0, 4).map((url, i) => (
            <div
              key={url}
              className="relative h-14 w-14 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              {i === 0 ? (
                <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 text-[8px] font-semibold text-white">
                  Primary
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type SummaryPanelProps = {
  title?: string;
  children: ReactNode;
  warnings?: WarningItem[];
  ready?: boolean;
  readyLabel?: string;
  className?: string;
  showWarnings?: boolean;
};

export function SummaryPanel({
  title,
  children,
  warnings = [],
  ready = false,
  readyLabel = "Ready to Create",
  className,
  showWarnings = true,
}: SummaryPanelProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {title ? (
        <div className="px-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
          {title}
        </div>
      ) : null}
      {children}
      {showWarnings ? (
        <div
          className={cn(
            "rounded-xl border px-3 py-2.5",
            ready
              ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
              : "border-amber-200/80 bg-amber-50/70 text-amber-900"
          )}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">Warnings</div>
          {ready || warnings.length === 0 ? (
            <p className="mt-1 text-sm font-semibold">✓ {readyLabel}</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {warnings.map((w) => (
                <li key={w.id} className="text-xs leading-snug">
                  {w.tone === "error" ? "✕" : "⚠"} {w.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
