import type { WorkflowEvent, WorkflowEventHandler, WorkflowEventType } from "../types/events";

/** In-process event bus; swap implementation later (Redis/NATS) without changing callers. */
export class EventBus {
  private handlers = new Map<WorkflowEventType | "*", Set<WorkflowEventHandler>>();

  subscribe(type: WorkflowEventType | "*", handler: WorkflowEventHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  async publish(event: WorkflowEvent): Promise<void> {
    const specific = this.handlers.get(event.type);
    const all = this.handlers.get("*");
    const list = [...(specific ?? []), ...(all ?? [])];
    for (const h of list) {
      await h(event);
    }
  }
}

export const defaultEventBus = new EventBus();

export function createEvent(
  partial: Omit<WorkflowEvent, "createdAt"> & { createdAt?: string }
): WorkflowEvent {
  return { ...partial, createdAt: partial.createdAt ?? new Date().toISOString() };
}
