export type WorkflowEventType =
  | "WORKFLOW_STARTED"
  | "WORKFLOW_COMPLETED"
  | "WORKFLOW_CANCELLED"
  | "TASK_READY"
  | "TASK_CLAIMED"
  | "TASK_STARTED"
  | "TASK_COMPLETED"
  | "TASK_FAILED"
  | "VARIABLE_CHANGED";

export interface WorkflowEvent {
  type: WorkflowEventType;
  tenantId: string;
  instanceId: string;
  entityType: string;
  entityId: string;
  taskId?: string;
  activityKey?: string;
  taskType?: string;
  actorUserId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export type WorkflowEventHandler = (event: WorkflowEvent) => void | Promise<void>;
