-- Perishability / batch-lot / expiry tracking with FEFO support (e.g. fruits & vegetables).
-- Additive: the aggregate WarehouseStock pool is untouched; batches are an opt-in detail
-- layer enabled per product via Product.trackBatches.

-- 1. Opt-in flags on Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trackBatches" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shelfLifeDays" INTEGER;

-- 2. Link stock movements to the batch they drew from / added to
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "batchId" TEXT;

-- 3. StockBatch: a received lot with its own expiry date
CREATE TABLE IF NOT EXISTS "StockBatch" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "productId"       TEXT NOT NULL,
  "warehouseId"     TEXT NOT NULL,
  "variantId"       TEXT,
  "batchNo"         TEXT NOT NULL,
  "quantity"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "initialQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "expiryDate"      TIMESTAMP(3),
  "receivedDate"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isExpired"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockBatch_pkey" PRIMARY KEY ("id")
);

-- One batch row per (product, warehouse, variant, batchNo) within a tenant.
-- NULLS NOT DISTINCT so SIMPLE products (variantId = NULL) collapse to one row per batchNo.
CREATE UNIQUE INDEX IF NOT EXISTS "StockBatch_tenant_product_wh_variant_batchNo_key"
  ON "StockBatch" ("tenantId", "productId", "warehouseId", "variantId", "batchNo")
  NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS "StockBatch_tenantId_idx" ON "StockBatch" ("tenantId");

-- FEFO picking: earliest expiry first within a product+warehouse+variant scope.
CREATE INDEX IF NOT EXISTS "StockBatch_fefo_idx"
  ON "StockBatch" ("tenantId", "productId", "warehouseId", "variantId", "expiryDate");

-- Expiry sweep across the whole tenant.
CREATE INDEX IF NOT EXISTS "StockBatch_tenantId_expiryDate_idx"
  ON "StockBatch" ("tenantId", "expiryDate");

CREATE INDEX IF NOT EXISTS "StockMovement_batchId_idx" ON "StockMovement" ("batchId");

-- 4. Foreign keys
ALTER TABLE "StockBatch"
  ADD CONSTRAINT "StockBatch_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockBatch"
  ADD CONSTRAINT "StockBatch_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockBatch"
  ADD CONSTRAINT "StockBatch_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "StockBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
