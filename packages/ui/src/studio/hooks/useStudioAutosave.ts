"use client";

import { useStudioDraft } from "./useStudio";

/** Alias — autosave is owned by StudioProvider; this exposes draft status. */
export function useStudioAutosave() {
  return useStudioDraft();
}
