"use client";

import type { ReactNode } from "react";
import { useStudioContext, useStudioDraft, useStudioNavigation, useStudioWorkflow } from "../../hooks";
import { StudioLayout } from "../../../authoring/StudioLayout";
import { FooterActions, FooterStat } from "../../../authoring/FooterActions";
import { StudioRail } from "./StudioRail";
import { StudioWorkspace } from "../../workspace/StudioWorkspace";
import { StudioSummaryPanel } from "./StudioSummaryPanel";

export type DesktopRendererProps = {
  header?: ReactNode;
  onClose?: () => void;
  variant?: "page" | "dialog";
  className?: string;
};

/**
 * Desktop chrome: Rail | Workspace | Summary | Footer.
 * Owns layout only — consumes kernel via hooks.
 */
export function DesktopRenderer({ header, onClose, variant = "page", className }: DesktopRendererProps) {
  const { steps, activeStepId, goToStep, goNext, goPrevious } = useStudioNavigation();
  const { lastSavedAt, saveDraft, isDirty } = useStudioDraft();
  const { submit, busy } = useStudioWorkflow();
  const { registrySteps } = useStudioContext();
  const active = registrySteps.find((s) => s.id === activeStepId);
  const isLast = steps[steps.length - 1]?.id === activeStepId;

  const railSteps = steps.map((s) => ({
    id: s.id,
    label: s.title,
    hint: s.subtitle,
    status: s.status,
  }));

  const defaultHeader = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">Studio</p>
        <h1 className="font-display text-xl font-semibold text-[var(--ink)]">{active?.title ?? "Create"}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void saveDraft()}
          className="inline-flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--mist)]"
        >
          Save draft
        </button>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--ink-soft)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
          >
            Close
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <StudioLayout
      variant={variant}
      className={className}
      workspaceKey={activeStepId}
      header={header ?? defaultHeader}
      rail={<StudioRail steps={railSteps} onSelect={(id) => void goToStep(id)} />}
      workspace={<StudioWorkspace />}
      summary={<StudioSummaryPanel />}
      footer={
        <FooterActions
          stats={
            <>
              <FooterStat
                label="Draft"
                value={
                  lastSavedAt
                    ? lastSavedAt.toLocaleTimeString()
                    : isDirty
                      ? "Unsaved"
                      : "—"
                }
              />
            </>
          }
          actions={
            <>
              <button
                type="button"
                onClick={goPrevious}
                disabled={steps[0]?.id === activeStepId}
                className="inline-flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--mist)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void saveDraft()}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--mist)] hover:text-[var(--ink)]"
              >
                Save draft
              </button>
              {isLast ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-mid)] disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create product"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void goNext()}
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-mid)]"
                >
                  Continue
                </button>
              )}
            </>
          }
        />
      }
    />
  );
}
