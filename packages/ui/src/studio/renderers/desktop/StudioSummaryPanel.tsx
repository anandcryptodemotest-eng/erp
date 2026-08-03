"use client";

import { useStudioContext } from "../../hooks";

/** Desktop summary column — renders registered SummaryComponents. */
export function StudioSummaryPanel() {
  const { registrySteps, workflow } = useStudioContext();

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">Summary</div>
      {registrySteps.map((step) => {
        const Summary = step.SummaryComponent;
        if (!Summary) return null;
        return (
          <div key={step.id}>
            <Summary />
          </div>
        );
      })}
      {workflow && !workflow.ok && workflow.errors?.length ? (
        <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-3 text-xs text-[var(--danger)]">
          {workflow.errors.map((e) => (
            <p key={e.id}>{e.message}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
