ALTER TABLE "JournalEntry"
  ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_tenantId_sourceRef_key"
  ON "JournalEntry" ("tenantId", "sourceRef");