export interface WorkflowMetricSnapshot {
  activeWorkflows: number;
  completedWorkflows: number;
  readyTasks: number;
  failedTasks: number;
  retryCount: number;
}

export class InMemoryMetrics {
  activeWorkflows = 0;
  completedWorkflows = 0;
  readyTasks = 0;
  failedTasks = 0;
  retryCount = 0;
  taskDurationsMs: number[] = [];

  snapshot(): WorkflowMetricSnapshot {
    return {
      activeWorkflows: this.activeWorkflows,
      completedWorkflows: this.completedWorkflows,
      readyTasks: this.readyTasks,
      failedTasks: this.failedTasks,
      retryCount: this.retryCount,
    };
  }
}

export const defaultMetrics = new InMemoryMetrics();
