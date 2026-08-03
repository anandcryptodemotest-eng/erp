"use client";

import { useState } from "react";
import { useStudioContext, useStudioDraft, useStudioNavigation, useStudioWorkflow } from "../../hooks";
import { StudioWorkspace } from "../../workspace/StudioWorkspace";
import { cn } from "../../../utils";

export type MobileRendererProps = {
  onClose?: () => void;
  className?: string;
};

/**
 * Mobile chrome: Progress | Workspace | Summary sheet | Bottom action bar.
 */
export function MobileRenderer({ onClose, className }: MobileRendererProps) {
  const { steps, activeStepId, goNext, goPrevious } = useStudioNavigation();
  const { saveDraft, lastSavedAt } = useStudioDraft();
  const { submit, busy } = useStudioWorkflow();
  const { registrySteps } = useStudioContext();
  const [summaryOpen, setSummaryOpen] = useState(false);

  const idx = Math.max(0, steps.findIndex((s) => s.id === activeStepId));
  const active = registrySteps.find((s) => s.id === activeStepId);
  const isLast = idx === steps.length - 1;
  const isFirst = idx <= 0;

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col bg-[var(--canvas)]", className)}>
      <header className="shrink-0 border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--ink-soft)]">
            Step {idx + 1} of {steps.length}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSummaryOpen(true)}
              className="text-xs font-semibold text-[var(--brand)]"
            >
              Summary
            </button>
            {onClose ? (
              <button type="button" onClick={onClose} className="text-xs font-medium text-[var(--ink-soft)]">
                Close
              </button>
            ) : null}
          </div>
        </div>
        <h1 className="mt-1 font-display text-lg font-semibold text-[var(--ink)]">{active?.title}</h1>
        {active?.subtitle ? <p className="text-xs text-[var(--ink-soft)]">{active.subtitle}</p> : null}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--mist)]">
          <div
            className="h-full rounded-full bg-[var(--brand)] transition-[width]"
            style={{ width: `${((idx + 1) / Math.max(steps.length, 1)) * 100}%` }}
          />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <StudioWorkspace />
      </main>

      <footer className="shrink-0 border-t border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3">
        <p className="mb-2 text-[11px] text-[var(--ink-soft)]">
          {lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : "Draft"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isFirst}
            onClick={goPrevious}
            className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] py-2.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => void saveDraft()}
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--ink-soft)] hover:bg-[var(--mist)]"
          >
            Save
          </button>
          {isLast ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="flex-1 rounded-lg bg-[var(--brand)] py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] disabled:opacity-50"
            >
              {busy ? "…" : "Create"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void goNext()}
              className="flex-1 rounded-lg bg-[var(--brand)] py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)]"
            >
              Continue
            </button>
          )}
        </div>
      </footer>

      {summaryOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setSummaryOpen(false)}>
          <div
            className="max-h-[70vh] overflow-y-auto rounded-t-2xl bg-[var(--surface-raised)] p-4 shadow-[var(--shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Summary</h2>
              <button type="button" className="text-xs text-[var(--ink-soft)]" onClick={() => setSummaryOpen(false)}>
                Close
              </button>
            </div>
            {registrySteps.map((step) => {
              const Summary = step.SummaryComponent;
              if (!Summary) return null;
              return (
                <div key={step.id} className="mb-3">
                  <Summary />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
