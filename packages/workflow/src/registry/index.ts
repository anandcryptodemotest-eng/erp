import type { TaskTypeHandler, WorkflowDomainAdapter } from "../types/adapter";

/**
 * Task types and domain adapters are registered by apps at bootstrap.
 * Platform package never imports domain modules.
 */
export class TaskTypeRegistry {
  private handlers = new Map<string, TaskTypeHandler>();
  private meta = new Map<string, { label: string; kind?: "HUMAN" | "SYSTEM" }>();

  register(type: string, handler: TaskTypeHandler, meta?: { label: string; kind?: "HUMAN" | "SYSTEM" }): void {
    this.handlers.set(type, handler);
    if (meta) this.meta.set(type, meta);
  }

  /** Register type metadata without handler (designer library / validation) */
  registerType(type: string, meta: { label: string; kind?: "HUMAN" | "SYSTEM" }): void {
    this.meta.set(type, meta);
  }

  has(type: string): boolean {
    return this.meta.has(type) || this.handlers.has(type);
  }

  getHandler(type: string): TaskTypeHandler | undefined {
    return this.handlers.get(type);
  }

  list(): { type: string; label: string; kind?: "HUMAN" | "SYSTEM" }[] {
    const keys = new Set([...this.meta.keys(), ...this.handlers.keys()]);
    return [...keys].map((type) => ({
      type,
      label: this.meta.get(type)?.label ?? type,
      kind: this.meta.get(type)?.kind,
    }));
  }

  keys(): string[] {
    return [...new Set([...this.meta.keys(), ...this.handlers.keys()])];
  }
}

export class AdapterRegistry {
  private adapters = new Map<string, WorkflowDomainAdapter>();

  register(entityType: string, adapter: WorkflowDomainAdapter): void {
    this.adapters.set(entityType, adapter);
  }

  get(entityType: string): WorkflowDomainAdapter | undefined {
    return this.adapters.get(entityType);
  }

  has(entityType: string): boolean {
    return this.adapters.has(entityType);
  }
}

export const defaultTaskTypeRegistry = new TaskTypeRegistry();
export const defaultAdapterRegistry = new AdapterRegistry();
