type Handler = (type: string, payload?: Record<string, unknown>) => void;

/**
 * Lightweight pub/sub for Studio (telemetry, audit, AI later).
 * One bus per StudioProvider instance.
 */
export function createStudioEvents() {
  const listeners = new Map<string, Set<Handler>>();

  function subscribe(type: string, handler: Handler): () => void {
    const key = type;
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(handler);
    return () => {
      listeners.get(key)?.delete(handler);
    };
  }

  function publish(type: string, payload?: Record<string, unknown>) {
    const run = (set?: Set<Handler>) => {
      if (!set) return;
      for (const h of set) h(type, payload);
    };
    run(listeners.get(type));
    run(listeners.get("*"));
  }

  return { publish, subscribe };
}

export type StudioEventsBus = ReturnType<typeof createStudioEvents>;
