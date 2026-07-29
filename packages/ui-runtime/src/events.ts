import type { UIEvent, UIEventBus, UIEventType } from "./types";

export function createUIEventBus(): UIEventBus {
  const handlers = new Map<string, Set<(event: UIEvent) => void>>();

  return {
    publish(event: UIEvent) {
      const specific = handlers.get(event.type);
      specific?.forEach((h) => h(event));
      const all = handlers.get("*");
      all?.forEach((h) => h(event));
    },
    subscribe(type: UIEventType | "*", handler: (event: UIEvent) => void) {
      let set = handlers.get(type);
      if (!set) {
        set = new Set();
        handlers.set(type, set);
      }
      set.add(handler);
      return () => set!.delete(handler);
    },
  };
}
