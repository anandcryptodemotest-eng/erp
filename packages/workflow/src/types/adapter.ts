import type { WorkflowContext, TaskInstance, ValidationResult, ExecuteResult, ProjectionPatch, EntitySnapshot } from "./runtime";

/**
 * Domain adapters are implemented in apps/* (sales, procurement, …).
 * packages/workflow never imports domain modules.
 */
export interface WorkflowDomainAdapter {
  loadEntity(entityType: string, entityId: string): Promise<EntitySnapshot>;
  validateTask(task: TaskInstance, payload: unknown, ctx: WorkflowContext): Promise<ValidationResult>;
  execute(task: TaskInstance, payload: unknown, ctx: WorkflowContext): Promise<ExecuteResult>;
  project(task: TaskInstance, ctx: WorkflowContext): Promise<ProjectionPatch>;
}

export type TaskTypeHandler = (
  task: TaskInstance,
  payload: unknown,
  ctx: WorkflowContext
) => Promise<ExecuteResult>;
