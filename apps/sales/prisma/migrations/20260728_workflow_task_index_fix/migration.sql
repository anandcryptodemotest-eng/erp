-- The unique constraint on (workflowInstanceId, action, status) was too strict:
-- a workflow can legitimately produce multiple CANCELLED or COMPLETED tasks for the
-- same action over its lifetime (e.g. re-entering a step). Only "one open task per
-- action" needs to be unique, and that is already enforced in application logic
-- (see syncWorkflowTasks' alreadyOpen check). Replace with a plain lookup index.
DROP INDEX IF EXISTS "WorkflowTask_workflowInstanceId_action_status_key";
CREATE INDEX IF NOT EXISTS "WorkflowTask_workflowInstanceId_action_status_idx" ON "WorkflowTask"("workflowInstanceId", "action", "status");
