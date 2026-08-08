CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_tenantId_sourceRef_key"
  ON "Invoice" ("tenantId", "sourceRef");