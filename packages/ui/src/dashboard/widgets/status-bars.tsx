"use client";

import {
  formatStatusLabel,
  type StatusCount,
} from "../charts/hrefs";

/** Compact horizontal status bars — preferred over donuts for ops (BL-043). */
export function StatusBars({
  items,
  hrefFor,
  actionHint = "Open →",
}: {
  items: StatusCount[];
  hrefFor: (status: string) => string;
  actionHint?: string;
}) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct = Math.max(8, Math.round((item.count / max) * 100));
        return (
          <a
            key={item.status}
            href={hrefFor(item.status)}
            title={`${formatStatusLabel(item.status)} · ${item.count} · ${actionHint}`}
            className="block rounded-md px-0.5 py-0.5 hover:bg-[var(--mist,#f4f6f5)]"
          >
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-semibold text-[var(--ink,#1a1a1a)]">
                {formatStatusLabel(item.status)}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--ink-soft,#666)]">{item.count}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--mist,#f4f6f5)]">
              <div
                className="h-full rounded-full bg-[var(--brand,#c8922a)] transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </a>
        );
      })}
    </div>
  );
}
