"use client";

import { useEffect, useState } from "react";
import { Button } from "@erp/ui";

/** Registers SW; shows update toast when a new version is waiting. */
export function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    void navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (cancelled) return;
        if (reg.waiting) {
          setWaiting(reg.waiting);
          setUpdateReady(true);
        }
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(sw);
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[var(--z-toast)] flex w-[min(92vw,24rem)] -translate-x-1/2 items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-sm text-white shadow-[var(--shadow)]">
      <span className="flex-1">A new version is available.</span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          waiting?.postMessage({ type: "SKIP_WAITING" });
          window.location.reload();
        }}
      >
        Refresh
      </Button>
    </div>
  );
}
