-- AlterTable
ALTER TABLE "User" ADD COLUMN "phoneNormalized" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_phoneNormalized_key" ON "User"("phoneNormalized");

-- AlterEnum
ALTER TYPE "CredentialType" ADD VALUE 'PHONE';

-- CreateTable
CREATE TABLE "TenantIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "config" JSONB,
    "lastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantIntegration_tenantId_provider_key" ON "TenantIntegration"("tenantId", "provider");
CREATE INDEX "TenantIntegration_tenantId_idx" ON "TenantIntegration"("tenantId");

ALTER TABLE "TenantIntegration" ADD CONSTRAINT "TenantIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TenantIntegrationSecret" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "keyName" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "lastFour" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantIntegrationSecret_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantIntegrationSecret_tenantId_provider_keyName_key" ON "TenantIntegrationSecret"("tenantId", "provider", "keyName");
CREATE INDEX "TenantIntegrationSecret_tenantId_idx" ON "TenantIntegrationSecret"("tenantId");

ALTER TABLE "TenantIntegrationSecret" ADD CONSTRAINT "TenantIntegrationSecret_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "providerRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OtpChallenge_tenantId_phoneNormalized_createdAt_idx" ON "OtpChallenge"("tenantId", "phoneNormalized", "createdAt");
CREATE INDEX "OtpChallenge_tenantId_phoneNormalized_purpose_idx" ON "OtpChallenge"("tenantId", "phoneNormalized", "purpose");

ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
