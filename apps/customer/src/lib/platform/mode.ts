"use client";

import { useEffect, useState } from "react";

export type PresentationMode = "web" | "pwa" | "native";

/** Detect Capacitor → native, display-mode standalone → pwa, else web. */
export function detectPresentationMode(): PresentationMode {
  if (typeof window === "undefined") return "web";
  const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
  if (w.Capacitor?.isNativePlatform?.()) return "native";
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "pwa";
  // iOS Safari "Add to Home Screen"
  if ((navigator as Navigator & { standalone?: boolean }).standalone) return "pwa";
  return "web";
}

export function usePresentationMode(): PresentationMode {
  const [mode, setMode] = useState<PresentationMode>("web");
  useEffect(() => {
    setMode(detectPresentationMode());
  }, []);
  return mode;
}

export function isAppChrome(mode: PresentationMode): boolean {
  return mode === "pwa" || mode === "native";
}
