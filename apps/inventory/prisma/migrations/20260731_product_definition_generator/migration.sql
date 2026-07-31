-- CreateEnum
CREATE TYPE "ProductDefinitionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable ProductAttributeDefinition
ALTER TABLE "ProductAttributeDefinition" ADD COLUMN "isIdentity" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable ProductDefinition
CREATE TABLE "ProductDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "brandId" TEXT,
    "defaultPricingBasis" TEXT NOT NULL DEFAULT 'PER_EACH',
    "defaultPricingUom" TEXT,
    "defaultBaseRate" DOUBLE PRECISION,
    "skuTemplate" TEXT,
    "allowedValues" JSONB NOT NULL DEFAULT '{}',
    "constraints" JSONB,
    "generationOptions" JSONB,
    "identityAttributeKeys" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "generatedProductCount" INTEGER NOT NULL DEFAULT 0,
    "lastGeneratedAt" TIMESTAMP(3),
    "status" "ProductDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDefinition_pkey" PRIMARY KEY ("id")
);

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "configKey" TEXT;
ALTER TABLE "Product" ADD COLUMN "productDefinitionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductDefinition_tenantId_name_key" ON "ProductDefinition"("tenantId", "name");
CREATE INDEX "ProductDefinition_tenantId_idx" ON "ProductDefinition"("tenantId");
CREATE INDEX "ProductDefinition_tenantId_status_idx" ON "ProductDefinition"("tenantId", "status");

CREATE UNIQUE INDEX "Product_tenantId_configKey_key" ON "Product"("tenantId", "configKey");
CREATE INDEX "Product_productDefinitionId_idx" ON "Product"("productDefinitionId");

-- AddForeignKey
ALTER TABLE "ProductDefinition" ADD CONSTRAINT "ProductDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductDefinition" ADD CONSTRAINT "ProductDefinition_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_productDefinitionId_fkey" FOREIGN KEY ("productDefinitionId") REFERENCES "ProductDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
