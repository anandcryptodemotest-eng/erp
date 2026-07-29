export type TaskInstanceStatus =
  | "WAITING"
  | "READY"
  | "CLAIMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "SKIPPED"
  | "DEAD_LETTER";

export type WorkflowInstanceStatus = "RUNNING" | "COMPLETED" | "CANCELLED";

export interface TaskInstance {
  id: string;
  workflowInstanceId: string;
  tenantId: string;
  activityKey: string;
  taskType: string;
  kind: "HUMAN" | "SYSTEM";
  status: TaskInstanceStatus;
  optional: boolean;
  assigneeUserId?: string | null;
  claimedAt?: string | null;
  leaseExpiresAt?: string | null;
  attempt: number;
  rowVersion: number;
  payload?: Record<string, unknown> | null;
  startedAt?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  errorMessage?: string | null;
}

export interface WorkflowInstance {
  id: string;
  tenantId: string;
  template: string;
  templateVersion: number;
  entityType: string;
  entityId: string;
  status: WorkflowInstanceStatus;
  /** Immutable copy of published WorkflowDefinition at start */
  snapshot: import("./definition").WorkflowDefinition;
  variables: Record<string, unknown>;
  createdAt: string;
  completedAt?: string | null;
}

export interface WorkflowContext {
  tenantId: string;
  instance: WorkflowInstance;
  task: TaskInstance;
  actorUserId: string;
  actorRole?: string | null;
  variables: Record<string, unknown>;
}

export interface EntitySnapshot {
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
}

export interface ValidationResult {
  ok: boolean;
  errors?: string[];
}

export interface ExecuteResult {
  variablesPatch?: Record<string, unknown>;
  projectionStatus?: string;
  payload?: Record<string, unknown>;
}

export interface ProjectionPatch {
  status?: string;
  fields?: Record<string, unknown>;
}
