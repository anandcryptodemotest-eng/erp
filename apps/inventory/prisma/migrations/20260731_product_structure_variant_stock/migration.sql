-- Platform product model: ProductStructure + variantAxes; WarehouseStock per variant

CREATE TYPE "ProductStructure" AS ENUM ('SIMPLE', 'VARIANT');

ALTER TABLE "Product" ADD COLUMN "productStructure" "ProductStructure" NOT NULL DEFAULT 'SIMPLE';
ALTER TABLE "Product" ADD COLUMN "variantAxes" JSONB NOT NULL DEFAULT '[]';

UPDATE "Product" SET "productStructure" = 'VARIANT' WHERE "hasVariants" = true;

ALTER TABLE "Product" DROP COLUMN "hasVariants";

ALTER TABLE "ProductVariant" ADD COLUMN "barcode" TEXT;

ALTER TABLE "WarehouseStock" ADD COLUMN "variantId" TEXT;

ALTER TABLE "WarehouseStock" DROP CONSTRAINT IF EXISTS "WarehouseStock_productId_warehouseId_key";

CREATE UNIQUE INDEX "WarehouseStock_productId_warehouseId_variantId_key"
  ON "WarehouseStock" ("productId", "warehouseId", "variantId")
  NULLS NOT DISTINCT;

CREATE INDEX "WarehouseStock_variantId_idx" ON "WarehouseStock"("variantId");

ALTER TABLE "WarehouseStock"
  ADD CONSTRAINT "WarehouseStock_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
