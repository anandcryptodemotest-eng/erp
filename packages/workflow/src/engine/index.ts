/**
 * Engine stubs — full runtime (start/claim/complete/evaluateGraph) lands in engine-runtime todo.
 * These types document the public surface so designer/simulation can depend on the package early.
 */

import type { WorkflowDefinition } from "../types/definition";
import type { TaskInstance, WorkflowInstance } from "../types/runtime";

export interface StartWorkflowInput {
  tenantId: string;
  entityType: string;
  entityId: string;
  definition: WorkflowDefinition; // must be a published snapshot copy
  variables?: Record<string, unknown>;
}

export interface StartWorkflowResult {
  instance: WorkflowInstance;
  tasks: TaskInstance[];
}

/** Pure graph readiness helper used by simulation and (later) runtime persistence layer */
export { evaluateReadiness, type EvaluateGraphResult, type TerminalStatus } from "./evaluate";
