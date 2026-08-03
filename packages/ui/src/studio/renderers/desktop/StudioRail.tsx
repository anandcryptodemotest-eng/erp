"use client";

import { cn } from "../../../utils";

export type StudioStepStatus =
  | "pending"
  | "active"
  | "completed"
  | "error"
  | "disabled"
  | "upcoming"
  | "current"
  | "done";

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

function normalize(status: StudioStepStatus) {
  if (status === "upcoming") return "pending";
  if (status === "current") return "active";
  if (status === "done") return "completed";
  return status;
}

/** Desktop chrome: vertical step rail. */
export function StudioRail({ steps, onSelect, className }: StepRailProps) {
  return (
    <nav className={cn("flex flex-col p-4", className)} aria-label="Studio steps">
      {steps.map((step, i) => {
        const status = normalize(step.status);
        const isCurrent = status === "active";
        const isDone = status === "completed";
        const isError = status === "error";
        const isDisabled = status === "disabled";
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
              disabled={isDisabled}
              onClick={() => !isDisabled && onSelect(step.id)}
              className={cn(
                "relative mb-1 flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                isCurrent && "bg-[color-mix(in_srgb,var(--brand)_10%,var(--mist))] ring-1 ring-[color-mix(in_srgb,var(--brand)_22%,transparent)]",
                isError && "ring-1 ring-[var(--danger)]/40",
                isDisabled && "opacity-40 cursor-not-allowed",
                !isCurrent && !isDisabled && "hover:bg-[var(--mist)]"
              )}
            >
              <span
                className={cn(
                  "relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  isDone && "bg-[var(--brand)] text-white",
                  isError && "bg-[var(--danger)] text-white",
                  isCurrent &&
                    !isError &&
                    "bg-[color-mix(in_srgb,var(--brand)_18%,white)] text-[var(--brand)] ring-2 ring-[color-mix(in_srgb,var(--brand)_35%,transparent)]",
                  !isDone &&
                    !isCurrent &&
                    !isError &&
                    "border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-soft)]"
                )}
              >
                {isDone ? "✓" : isError ? "!" : i + 1}
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

/** @deprecated Use StudioRail */
export const StepRail = StudioRail;
