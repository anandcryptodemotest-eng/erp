-- Accounting dynamic tax support for multi-country scenarios
ALTER TABLE "TaxRate"
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT 'IN',
  ADD COLUMN IF NOT EXISTS "taxType" TEXT NOT NULL DEFAULT 'GST',
  ADD COLUMN IF NOT EXISTS "regionCode" TEXT,
  ADD COLUMN IF NOT EXISTS "components" JSONB,
  ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TaxRate_tenantId_code_key'
  ) THEN
    ALTER TABLE "TaxRate" DROP CONSTRAINT "TaxRate_tenantId_code_key";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TaxRate_tenantId_countryCode_code_key'
  ) THEN
    ALTER TABLE "TaxRate"
      ADD CONSTRAINT "TaxRate_tenantId_countryCode_code_key"
      UNIQUE ("tenantId", "countryCode", "code");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TaxRate_tenantId_countryCode_isActive_idx"
  ON "TaxRate" ("tenantId", "countryCode", "isActive");

ALTER TABLE "Bill"
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT 'IN',
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';

ALTER TABLE "BillItem"
  ADD COLUMN IF NOT EXISTS "taxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxCode" TEXT,
  ADD COLUMN IF NOT EXISTS "taxType" TEXT,
  ADD COLUMN IF NOT EXISTS "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "BillReturnItem"
  ADD COLUMN IF NOT EXISTS "taxCode" TEXT,
  ADD COLUMN IF NOT EXISTS "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
