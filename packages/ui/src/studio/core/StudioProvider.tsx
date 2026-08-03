"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FormProvider, useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createStudioEvents } from "../events/StudioEvents";
import { runWorkflowValidation, validateWithSchema } from "../validation/WorkflowEngine";
import type {
  StudioContextValue,
  StudioEventHandler,
  StudioEventPayload,
  StudioEventType,
  StudioProviderProps,
  StudioStepStatus,
  StudioStepViewModel,
} from "./types";

const StudioContext = createContext<StudioContextValue | null>(null);

function mergePlugins<T extends FieldValues>(
  steps: StudioProviderProps<T>["registry"]["steps"],
  plugins: StudioProviderProps<T>["plugins"]
) {
  if (!plugins?.length) return steps;
  const extra = plugins.flatMap((p) => (p.steps ?? []) as typeof steps);
  return [...steps, ...extra];
}

/**
 * Thin facade: wires RHF + StudioKernel context. Hosts inject a StudioRenderer as children.
 */
export function StudioProvider<T extends FieldValues>({
  schema,
  defaultValues,
  registry,
  domain,
  plugins,
  children,
  onEvent,
  autosaveMs = 2000,
}: StudioProviderProps<T>) {
  const steps = useMemo(() => mergePlugins(registry.steps, plugins), [registry.steps, plugins]);
  const events = useMemo(() => createStudioEvents(), []);
  const [activeStepId, setActiveStepId] = useState(steps[0]?.id ?? "");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [workflow, setWorkflow] = useState<StudioContextValue["workflow"]>(null);
  const [stepValidity, setStepValidity] = useState<Record<string, boolean>>({});
  const restored = useRef(false);

  const form = useForm<T>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues,
    mode: "onChange",
  });

  const publish = useCallback(
    (type: StudioEventType, payload?: StudioEventPayload) => {
      events.publish(type, payload);
      onEvent?.(type, payload);
    },
    [events, onEvent]
  );

  const subscribe = useCallback(
    (type: StudioEventType | "*", handler: StudioEventHandler) =>
      events.subscribe(type, handler as (t: string, p?: Record<string, unknown>) => void),
    [events]
  );

  // Restore draft once
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    void (async () => {
      const partial = await domain.restoreDraft();
      if (partial && Object.keys(partial).length) {
        form.reset({ ...defaultValues, ...partial } as T);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = form.watch((values) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void (async () => {
          try {
            await domain.saveDraft(values as T);
            setLastSavedAt(new Date());
            publish("SAVE_DRAFT", {});
          } catch {
            /* domain handles errors */
          }
        })();
      }, autosaveMs);
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.unsubscribe();
    };
  }, [form, domain, autosaveMs, publish]);

  const enabledSteps = useMemo(() => steps.filter((s) => true), [steps]);

  const stepStatus = useMemo(() => {
    const map: Record<string, StudioStepStatus> = {};
    for (const s of enabledSteps) {
      if (s.id === activeStepId) map[s.id] = "active";
      else if (stepValidity[s.id] === false) map[s.id] = "error";
      else if (stepValidity[s.id] === true) map[s.id] = "completed";
      else map[s.id] = "pending";
    }
    return map;
  }, [enabledSteps, activeStepId, stepValidity]);

  const stepViewModels: StudioStepViewModel[] = useMemo(
    () =>
      enabledSteps.map((s) => ({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        status: stepStatus[s.id] ?? "pending",
        isValid: stepValidity[s.id] === true,
        hasChanges: form.formState.isDirty,
        analyticsKey: s.analyticsKey,
      })),
    [enabledSteps, stepStatus, stepValidity, form.formState.isDirty]
  );

  const validateStep = useCallback(
    async (stepId: string): Promise<boolean> => {
      const def = enabledSteps.find((s) => s.id === stepId);
      if (!def) return false;
      const values = form.getValues();
      const result = validateWithSchema(def.schema, values);
      setStepValidity((prev) => ({ ...prev, [stepId]: result.ok }));
      if (!result.ok) {
        await form.trigger();
      }
      return result.ok;
    },
    [enabledSteps, form]
  );

  const goToStep = useCallback(
    async (id: string): Promise<boolean> => {
      const target = enabledSteps.find((s) => s.id === id);
      if (!target) return false;
      const current = enabledSteps.find((s) => s.id === activeStepId);
      if (current?.onLeave) current.onLeave();
      const idx = enabledSteps.findIndex((s) => s.id === id);
      const curIdx = enabledSteps.findIndex((s) => s.id === activeStepId);
      if (idx > curIdx) {
        const ok = await validateStep(activeStepId);
        if (!ok) return false;
        if (current?.beforeNext) {
          const allow = await current.beforeNext();
          if (!allow) return false;
        }
      }
      setActiveStepId(id);
      target.onEnter?.();
      publish("STEP_CHANGED", { stepId: id, analyticsKey: target.analyticsKey });
      return true;
    },
    [enabledSteps, activeStepId, validateStep, publish]
  );

  const goNext = useCallback(async () => {
    const i = enabledSteps.findIndex((s) => s.id === activeStepId);
    if (i < 0 || i >= enabledSteps.length - 1) return false;
    return goToStep(enabledSteps[i + 1]!.id);
  }, [enabledSteps, activeStepId, goToStep]);

  const goPrevious = useCallback(() => {
    const i = enabledSteps.findIndex((s) => s.id === activeStepId);
    if (i <= 0) return;
    const prev = enabledSteps[i - 1]!;
    const current = enabledSteps[i];
    current?.onLeave?.();
    setActiveStepId(prev.id);
    prev.onEnter?.();
    publish("STEP_CHANGED", { stepId: prev.id, analyticsKey: prev.analyticsKey });
  }, [enabledSteps, activeStepId, publish]);

  const saveDraft = useCallback(async () => {
    await domain.saveDraft(form.getValues());
    setLastSavedAt(new Date());
    publish("SAVE_DRAFT", {});
  }, [domain, form, publish]);

  const restoreDraft = useCallback(async () => {
    const partial = await domain.restoreDraft();
    if (partial) form.reset({ ...form.getValues(), ...partial });
  }, [domain, form]);

  const preview = useCallback(async () => {
    if (!domain.preview) return undefined;
    const result = await domain.preview(form.getValues());
    publish("PREVIEW_READY", { result });
    return result;
  }, [domain, form, publish]);

  const submit = useCallback(async () => {
    for (const s of enabledSteps) {
      const ok = await validateStep(s.id);
      if (!ok) {
        setActiveStepId(s.id);
        return;
      }
      if (s.beforeSubmit) {
        const allow = await s.beforeSubmit();
        if (!allow) return;
      }
    }
    const values = form.getValues();
    const wf = await runWorkflowValidation(domain, values);
    setWorkflow(wf);
    if (!wf.ok) return;

    setBusy(true);
    try {
      await domain.submit(values);
      for (const s of enabledSteps) s.afterSubmit?.(undefined);
      publish("CREATE_SUCCESS", {});
    } catch (e) {
      publish("CREATE_ERROR", { error: String(e) });
      throw e;
    } finally {
      setBusy(false);
    }
  }, [enabledSteps, validateStep, form, domain, publish]);

  const value = useMemo<StudioContextValue<T>>(
    () => ({
      form,
      domain,
      steps: stepViewModels,
      registrySteps: enabledSteps,
      activeStepId,
      stepStatus,
      workflow,
      isDirty: form.formState.isDirty,
      lastSavedAt,
      busy,
      goNext,
      goPrevious,
      goToStep,
      saveDraft,
      restoreDraft,
      submit,
      preview,
      publish,
      subscribe,
    }),
    [
      form,
      domain,
      stepViewModels,
      enabledSteps,
      activeStepId,
      stepStatus,
      workflow,
      lastSavedAt,
      busy,
      goNext,
      goPrevious,
      goToStep,
      saveDraft,
      restoreDraft,
      submit,
      preview,
      publish,
      subscribe,
    ]
  );

  return (
    <FormProvider {...form}>
      <StudioContext.Provider value={value as StudioContextValue}>{children}</StudioContext.Provider>
    </FormProvider>
  );
}

export function useStudioContext<T extends FieldValues = FieldValues>(): StudioContextValue<T> {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio* hooks require <StudioProvider>");
  return ctx as StudioContextValue<T>;
}

/** Kernel coordination lives in StudioProvider; this marks the orchestration boundary. */
export function StudioKernel({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
