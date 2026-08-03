"use client";

export { StudioProvider, StudioKernel, useStudioContext } from "./core/StudioProvider";
export type {
  StudioDomain,
  StudioStepDefinition,
  StudioStepStatus,
  StudioStepViewModel,
  StudioProviderProps,
  StudioContextValue,
  StudioEventType,
  StudioEventPayload,
  StudioEventHandler,
  StudioPlugin,
  WorkflowValidationResult,
  StudioPlatform,
} from "./core/types";

export { createStudioRegistry, type StudioRegistry } from "./registry/createStudioRegistry";
export { createStudioEvents } from "./events/StudioEvents";
export { runWorkflowValidation, validateWithSchema } from "./validation/WorkflowEngine";

export {
  useStudio,
  useStudioNavigation,
  useStudioWorkflow,
  useStudioEvents,
  useStudioDraft,
  useStudioValidation,
  useStudioForm,
  useStudioAutosave,
  useStudioContext as useStudioCtx,
} from "./hooks";

export type { StudioRenderer, StudioRendererProps } from "./renderers/types";
export { DesktopRenderer, type DesktopRendererProps } from "./renderers/desktop/DesktopRenderer";
export { MobileRenderer, type MobileRendererProps } from "./renderers/mobile/MobileRenderer";
export { AutoStudioShell, type AutoStudioShellProps } from "./renderers/AutoStudioShell";
export { StudioRail, StepRail, type StudioStep, type StepRailProps } from "./renderers/desktop/StudioRail";
export { StudioWorkspace } from "./workspace/StudioWorkspace";
export { WorkspaceCard } from "./workspace/WorkspaceCard";
