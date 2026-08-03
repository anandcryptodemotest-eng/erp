"use client";

import { cn } from "@erp/ui";

export type DeskStage = "inbox" | "mywork" | "active";

const STAGES: { id: DeskStage; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "mywork", label: "My Work" },
  { id: "active", label: "Fulfillment" },
];

/** Hero stage rail — Kanban-like progression (Inbox → My Work → Fulfillment). */
export function StageRail({
  stage,
  counts,
  onChange,
  className,
}: {
  stage: DeskStage;
  counts: Record<DeskStage, number>;
  onChange: (s: DeskStage) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Sales Desk stages" className={cn("w-full", className)}>
      <ol
        className="flex flex-wrap items-stretch overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)]"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        {STAGES.map((s, i) => {
          const active = stage === s.id;
          return (
            <li key={s.id} className="relative flex min-w-0 flex-1">
              {i > 0 ? (
                <span
                  className="absolute inset-y-3 left-0 w-px bg-[var(--line)]"
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                onClick={() => onChange(s.id)}
                className={cn(
                  "relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
                  active
                    ? "bg-[var(--mist)] text-[var(--ink)]"
                    : "text-[var(--ink-soft)] hover:bg-[color-mix(in_srgb,var(--mist)_55%,transparent)] hover:text-[var(--ink)]"
                )}
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    active ? "bg-[var(--brand)]" : "bg-[var(--line)]"
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm font-semibold",
                      active && "text-[var(--ink)]"
                    )}
                  >
                    {s.label}
                  </span>
                </span>
                <span
                  className={cn(
                    "inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                    active
                      ? "bg-[var(--brand)] text-[var(--ink-inverse)]"
                      : "bg-[var(--mist)] text-[var(--ink-soft)]"
                  )}
                >
                  {counts[s.id]}
                </span>
                {active ? (
                  <span
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--brand)]"
                    aria-hidden
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function deskTabToStage(tab: "sreq" | "tasks" | "inflight"): DeskStage {
  if (tab === "sreq") return "inbox";
  if (tab === "inflight") return "active";
  return "mywork";
}

export function stageToDeskTab(stage: DeskStage): "sreq" | "tasks" | "inflight" {
  if (stage === "inbox") return "sreq";
  if (stage === "active") return "inflight";
  return "tasks";
}
