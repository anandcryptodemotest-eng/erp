import type { ComponentType, ReactNode } from "react";
import type { DefaultValues, FieldValues, UseFormReturn } from "react-hook-form";
import type { ZodTypeAny } from "zod";

/** Platform (React Web, React Native, Electron) ≠ Renderer (Desktop, Mobile, Native chrome). */
export type StudioPlatform = "react-web" | "react-native" | "electron" | "unknown";

export type StudioStepStatus = "pending" | "active" | "completed" | "error" | "disabled";

/** @deprecated Prefer pending|active|completed; kept for authoring compat. */
export type LegacyStudioStepStatus = "upcoming" | "current" | "done";

export type WorkflowValidationResult = {
  ok: boolean;
  errors?: { id: string; message: string }[];
};

export interface StudioDomain<T extends FieldValues> {
  preview?(values: T): Promise<unknown>;
  saveDraft(values: T): Promise<void>;
  restoreDraft(): Promise<Partial<T> | null>;
  submit(values: T): Promise<void>;
  validateWorkflow?(values: T): Promise<WorkflowValidationResult> | WorkflowValidationResult;
}

export interface StudioStepDefinition<TForm extends FieldValues = FieldValues> {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  permission?: string;
  analyticsKey?: string;
  schema: ZodTypeAny;
  Component: ComponentType;
  /** Optional actions rendered on the step card header (right of title). */
  HeaderActions?: ComponentType;
  SummaryComponent?: ComponentType;
  beforeNext?: () => Promise<boolean> | boolean;
  beforeSubmit?: () => Promise<boolean> | boolean;
  afterSubmit?: (result: unknown) => void;
  onEnter?: () => void;
  onLeave?: () => void;
}

export type StudioStepViewModel = {
  id: string;
  title: string;
  subtitle?: string;
  status: StudioStepStatus;
  isValid: boolean;
  hasChanges: boolean;
  analyticsKey?: string;
};

export type StudioEventType =
  | "STEP_CHANGED"
  | "FIELD_CHANGED"
  | "SAVE_DRAFT"
  | "PREVIEW_READY"
  | "CREATE_SUCCESS"
  | "CREATE_ERROR";

export type StudioEventPayload = Record<string, unknown> & {
  analyticsKey?: string;
};

export type StudioEventHandler = (type: StudioEventType, payload?: StudioEventPayload) => void;

export type StudioPlugin = {
  id: string;
  steps?: StudioStepDefinition[];
  summary?: ComponentType;
  navigation?: ComponentType;
  toolbar?: ComponentType;
  footer?: ComponentType;
};

export type StudioProviderProps<T extends FieldValues> = {
  schema: ZodTypeAny;
  defaultValues: DefaultValues<T>;
  registry: { steps: StudioStepDefinition<T>[] };
  domain: StudioDomain<T>;
  plugins?: StudioPlugin[];
  children: ReactNode;
  onEvent?: StudioEventHandler;
  /** Debounce ms for autosave (default 2000). */
  autosaveMs?: number;
};

export type StudioContextValue<T extends FieldValues = FieldValues> = {
  form: UseFormReturn<T>;
  domain: StudioDomain<T>;
  steps: StudioStepViewModel[];
  registrySteps: StudioStepDefinition<T>[];
  activeStepId: string;
  stepStatus: Record<string, StudioStepStatus>;
  workflow: WorkflowValidationResult | null;
  isDirty: boolean;
  lastSavedAt: Date | null;
  busy: boolean;
  goNext: () => Promise<boolean>;
  goPrevious: () => void;
  goToStep: (id: string) => Promise<boolean>;
  saveDraft: () => Promise<void>;
  restoreDraft: () => Promise<void>;
  submit: () => Promise<void>;
  preview: () => Promise<unknown>;
  publish: (type: StudioEventType, payload?: StudioEventPayload) => void;
  subscribe: (type: StudioEventType | "*", handler: StudioEventHandler) => () => void;
};
