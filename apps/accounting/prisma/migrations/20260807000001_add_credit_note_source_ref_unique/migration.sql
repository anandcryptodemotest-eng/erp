CREATE UNIQUE INDEX IF NOT EXISTS "CreditNote_tenantId_sourceRef_key"
  ON "CreditNote" ("tenantId", "sourceRef");