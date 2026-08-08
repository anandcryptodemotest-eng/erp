-- CreateTable
CREATE TABLE "ReconciliationRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "targetService" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "payload" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReconciliationRecord_tenantId_idempotencyKey_key" ON "ReconciliationRecord"("tenantId", "idempotencyKey");
CREATE INDEX "ReconciliationRecord_tenantId_status_nextRetryAt_idx" ON "ReconciliationRecord"("tenantId", "status", "nextRetryAt");
CREATE INDEX "ReconciliationRecord_tenantId_createdAt_idx" ON "ReconciliationRecord"("tenantId", "createdAt");

ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;