"use client";

import { useStudioContext } from "../core/StudioProvider";
import type { StudioContextValue } from "../core/types";

export function useStudioNavigation() {
  const ctx = useStudioContext();
  return {
    activeStepId: ctx.activeStepId,
    steps: ctx.steps,
    goNext: ctx.goNext,
    goPrevious: ctx.goPrevious,
    goToStep: ctx.goToStep,
  };
}

export function useStudioWorkflow() {
  const ctx = useStudioContext();
  return {
    submit: ctx.submit,
    preview: ctx.preview,
    workflow: ctx.workflow,
    busy: ctx.busy,
    canSubmit: ctx.steps.every((s) => s.status === "completed" || s.status === "active") && (ctx.workflow?.ok !== false),
  };
}

export function useStudioEvents() {
  const ctx = useStudioContext();
  return { publish: ctx.publish, subscribe: ctx.subscribe };
}

export function useStudioDraft() {
  const ctx = useStudioContext();
  return {
    saveDraft: ctx.saveDraft,
    restoreDraft: ctx.restoreDraft,
    lastSavedAt: ctx.lastSavedAt,
    isDirty: ctx.isDirty,
  };
}

export function useStudioValidation(): {
  stepStatus: StudioContextValue["stepStatus"];
  workflow: StudioContextValue["workflow"];
  formState: StudioContextValue["form"]["formState"];
} {
  const ctx = useStudioContext();
  return {
    stepStatus: ctx.stepStatus,
    workflow: ctx.workflow,
    formState: ctx.form.formState,
  };
}

export function useStudioForm() {
  return useStudioContext().form;
}

/** Convenience composition for simple hosts. Prefer focused hooks in steps. */
export function useStudio() {
  const ctx = useStudioContext();
  return ctx;
}

export { useStudioAutosave } from "./useStudioAutosave";
