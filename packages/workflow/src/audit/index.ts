import type { WorkflowEvent } from "../types/events";
import type { EventBus } from "../events";

export interface AuditEntry {
  id: string;
  event: WorkflowEvent;
}

/** Append-only in-memory audit sink; apps can subscribe and persist. */
export class AuditLog {
  entries: AuditEntry[] = [];
  private seq = 0;

  append(event: WorkflowEvent): void {
    this.entries.push({ id: `aud_${++this.seq}`, event });
  }

  attach(bus: EventBus): () => void {
    return bus.subscribe("*", (event) => {
      this.append(event);
    });
  }
}

export const defaultAuditLog = new AuditLog();
