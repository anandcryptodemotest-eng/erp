"use client";

import { cn } from "@erp/ui";

export type JourneyStep = {
  id: string;
  label: string;
  state: "done" | "current" | "upcoming";
};

const DEFAULT_STEPS = [
  "Created",
  "Converted",
  "Pricing",
  "Inventory",
  "Dispatch",
  "Invoice",
  "Paid",
] as const;

/** Read-only journey as status chips: ✔ done · ● current · ○ upcoming. */
export function JourneyTimeline({
  steps,
  className,
}: {
  steps: JourneyStep[];
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
        Journey
      </h3>
      <ol className="flex flex-wrap gap-2">
        {steps.map((step) => (
          <li key={step.id}>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                step.state === "done" &&
                  "border-[var(--line)] bg-[var(--mist)] text-[var(--ink)]",
                step.state === "current" &&
                  "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,var(--surface-raised))] text-[var(--ink)]",
                step.state === "upcoming" &&
                  "border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-soft)]"
              )}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              <span aria-hidden className="tabular-nums">
                {step.state === "done" ? "✔" : step.state === "current" ? "●" : "○"}
              </span>
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function statusToJourneyIndex(status?: string | null, hasConverted?: boolean): number {
  if (!hasConverted && status === "OPEN") return 0;
  const s = (status ?? "").toUpperCase();
  if (!s || s === "OPEN") return hasConverted ? 1 : 0;
  if (s === "CONFIRMED" || s === "FULFILLING") return 2;
  if (s === "READY_FOR_DISPATCH") return 3;
  if (s === "DISPATCHED") return 4;
  if (s === "DELIVERED") return 5;
  if (s === "INVOICED") return 5;
  if (s === "PAID" || s === "CLOSED") return 6;
  if (s === "CANCELLED" || s === "REJECTED") return 0;
  return hasConverted ? 1 : 0;
}

export function buildJourneySteps(opts: {
  status?: string | null;
  converted?: boolean;
  highlight?: "pricing" | "inventory" | null;
}): JourneyStep[] {
  let idx = statusToJourneyIndex(opts.status, opts.converted);
  if (opts.converted && opts.highlight === "pricing") idx = 2;
  if (opts.converted && opts.highlight === "inventory") idx = 3;
  if (opts.converted && (opts.status === "CONFIRMED" || opts.status === "FULFILLING") && !opts.highlight) {
    idx = 2;
  }
  if (opts.status === "READY_FOR_DISPATCH") idx = 3;
  if (opts.status === "DISPATCHED") idx = 4;
  if (opts.status === "DELIVERED") idx = 5;
  if (opts.status === "INVOICED") idx = 5;
  if (opts.status === "PAID" || opts.status === "CLOSED") idx = 6;

  return DEFAULT_STEPS.map((label, i) => ({
    id: label.toLowerCase(),
    label,
    state: i < idx ? "done" : i === idx ? "current" : "upcoming",
  }));
}
