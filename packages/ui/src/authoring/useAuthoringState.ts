"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type AuthoringValidation = {
  errors: { message: string; path?: string }[];
  warnings: { message: string; path?: string }[];
  canSave: boolean;
  canPublish: boolean;
};

export type UseAuthoringStateOptions<T> = {
  /** Initial saved snapshot (e.g. loaded definition) */
  initial: T | null;
  /** Live draft value */
  current: T | null;
  /** Domain validation for current draft */
  validate: (value: T) => AuthoringValidation;
};

/**
 * Shared authoring lifecycle: deep-equality dirty tracking, save status, unload guard.
 * Domain save/publish APIs stay in the studio; this hook only tracks state.
 */
export function useAuthoringState<T>({ initial, current, validate }: UseAuthoringStateOptions<T>) {
  const savedRef = useRef<T | null>(initial);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (initial != null && savedRef.current == null) {
      savedRef.current = initial;
    }
  }, [initial]);

  const dirty = useMemo(() => {
    if (current == null || savedRef.current == null) return false;
    return !deepEqual(savedRef.current, current);
  }, [current]);

  const validation = useMemo((): AuthoringValidation => {
    if (current == null) {
      return { errors: [], warnings: [], canSave: false, canPublish: false };
    }
    return validate(current);
  }, [current, validate]);

  const markSaved = useCallback((value: T) => {
    savedRef.current = value;
    setSaveStatus("saved");
    setSaveError(null);
  }, []);

  const markSaving = useCallback(() => {
    setSaveStatus("saving");
    setSaveError(null);
  }, []);

  const markSaveError = useCallback((message: string) => {
    setSaveStatus("error");
    setSaveError(message);
  }, []);

  const resetSaved = useCallback((value: T) => {
    savedRef.current = value;
    setSaveStatus("idle");
    setSaveError(null);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return {
    dirty,
    saveStatus,
    saveError,
    validation,
    markSaved,
    markSaving,
    markSaveError,
    resetSaved,
    savedSnapshot: savedRef.current,
  };
}

export function usePublishConfirm() {
  const [open, setOpen] = useState(false);
  return {
    open,
    ask: () => setOpen(true),
    cancel: () => setOpen(false),
    confirm: (fn: () => void | Promise<void>) => {
      setOpen(false);
      return fn();
    },
  };
}
