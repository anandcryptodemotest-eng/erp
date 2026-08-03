"use client";

import { useStudioContext } from "../hooks";
import { WorkspaceCard } from "./WorkspaceCard";

/** Renders the active step Component only (desktop single-step / mobile stack host). */
export function StudioWorkspace() {
  const { activeStepId, registrySteps } = useStudioContext();
  const step = registrySteps.find((s) => s.id === activeStepId);
  if (!step) return null;
  const Comp = step.Component;
  const HeaderActions = step.HeaderActions;
  return (
    <WorkspaceCard
      title={step.title}
      description={step.subtitle}
      headerRight={HeaderActions ? <HeaderActions /> : undefined}
    >
      <Comp />
    </WorkspaceCard>
  );
}
