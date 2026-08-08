ALTER TABLE "StockMovement"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "StockMovement_tenantId_idempotencyKey_key"
  ON "StockMovement" ("tenantId", "idempotencyKey");