CREATE TABLE IF NOT EXISTS "WorkflowInstance" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "currentStatus" TEXT NOT NULL,
  "currentStepKey" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkflowTask" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "workflowInstanceId" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "assignedRole" TEXT NOT NULL,
  "assignedUserId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "dueAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completedBy" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkflowEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "workflowInstanceId" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "stepKey" TEXT,
  "action" TEXT,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "actorUserId" TEXT,
  "actorRole" TEXT,
  "remarks" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowInstance_salesOrderId_key" ON "WorkflowInstance"("salesOrderId");
CREATE INDEX IF NOT EXISTS "WorkflowInstance_tenantId_workflowId_idx" ON "WorkflowInstance"("tenantId", "workflowId");
CREATE INDEX IF NOT EXISTS "WorkflowInstance_tenantId_currentStatus_idx" ON "WorkflowInstance"("tenantId", "currentStatus");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowTask_workflowInstanceId_action_status_key" ON "WorkflowTask"("workflowInstanceId", "action", "status");
CREATE INDEX IF NOT EXISTS "WorkflowTask_tenantId_assignedRole_status_idx" ON "WorkflowTask"("tenantId", "assignedRole", "status");
CREATE INDEX IF NOT EXISTS "WorkflowTask_tenantId_assignedUserId_status_idx" ON "WorkflowTask"("tenantId", "assignedUserId", "status");
CREATE INDEX IF NOT EXISTS "WorkflowTask_tenantId_salesOrderId_idx" ON "WorkflowTask"("tenantId", "salesOrderId");
CREATE INDEX IF NOT EXISTS "WorkflowEvent_tenantId_workflowInstanceId_createdAt_idx" ON "WorkflowEvent"("tenantId", "workflowInstanceId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkflowEvent_tenantId_salesOrderId_createdAt_idx" ON "WorkflowEvent"("tenantId", "salesOrderId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WorkflowInstance_salesOrderId_fkey'
  ) THEN
    ALTER TABLE "WorkflowInstance"
      ADD CONSTRAINT "WorkflowInstance_salesOrderId_fkey"
      FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WorkflowInstance_workflowId_fkey'
  ) THEN
    ALTER TABLE "WorkflowInstance"
      ADD CONSTRAINT "WorkflowInstance_workflowId_fkey"
      FOREIGN KEY ("workflowId") REFERENCES "OrderWorkflow"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WorkflowTask_workflowInstanceId_fkey'
  ) THEN
    ALTER TABLE "WorkflowTask"
      ADD CONSTRAINT "WorkflowTask_workflowInstanceId_fkey"
      FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WorkflowTask_salesOrderId_fkey'
  ) THEN
    ALTER TABLE "WorkflowTask"
      ADD CONSTRAINT "WorkflowTask_salesOrderId_fkey"
      FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WorkflowEvent_workflowInstanceId_fkey'
  ) THEN
    ALTER TABLE "WorkflowEvent"
      ADD CONSTRAINT "WorkflowEvent_workflowInstanceId_fkey"
      FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WorkflowEvent_salesOrderId_fkey'
  ) THEN
    ALTER TABLE "WorkflowEvent"
      ADD CONSTRAINT "WorkflowEvent_salesOrderId_fkey"
      FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
