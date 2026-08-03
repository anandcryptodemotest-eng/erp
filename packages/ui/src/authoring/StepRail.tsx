"use client";

import { cn } from "../utils";

export type StudioStepStatus = "upcoming" | "current" | "done";

export type StudioStep = {
  id: string;
  label: string;
  hint?: string;
  status: StudioStepStatus;
};

export type StepRailProps = {
  steps: StudioStep[];
  onSelect: (id: string) => void;
  className?: string;
};

export function StepRail({ steps, onSelect, className }: StepRailProps) {
  return (
    <nav className={cn("flex flex-col p-4", className)} aria-label="Studio steps">
      {steps.map((step, i) => {
        const isCurrent = step.status === "current";
        const isDone = step.status === "done";
        const isLast = i === steps.length - 1;
        return (
          <div key={step.id} className="relative flex gap-3">
            {!isLast && (
              <span
                className={cn(
                  "absolute left-[15px] top-8 bottom-0 w-px",
                  isDone ? "bg-[var(--brand)]/40" : "bg-[var(--line)]"
                )}
                aria-hidden
              />
            )}
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              className={cn(
                "relative mb-1 flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                isCurrent && "bg-[color-mix(in_srgb,var(--brand)_10%,var(--mist))] ring-1 ring-[color-mix(in_srgb,var(--brand)_22%,transparent)]",
                !isCurrent && "hover:bg-[var(--mist)]"
              )}
            >
              <span
                className={cn(
                  "relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  isDone && "bg-[var(--brand)] text-white",
                  isCurrent &&
                    "bg-[color-mix(in_srgb,var(--brand)_18%,white)] text-[var(--brand)] ring-2 ring-[color-mix(in_srgb,var(--brand)_35%,transparent)]",
                  !isDone &&
                    !isCurrent &&
                    "border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-soft)]"
                )}
              >
                {isDone ? "✓" : i + 1}
              </span>
              <span className="min-w-0 pt-0.5">
                <span
                  className={cn(
                    "block text-sm font-semibold leading-tight",
                    isCurrent ? "text-[var(--ink)]" : "text-[var(--ink-soft)]"
                  )}
                >
                  {step.label}
                </span>
                {step.hint ? (
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--ink-soft)]">
                    {step.hint}
                  </span>
                ) : null}
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
