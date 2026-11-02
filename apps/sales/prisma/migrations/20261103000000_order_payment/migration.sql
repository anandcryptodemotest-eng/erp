-- Customer order payments (prepaid online / UPI / card via PSP, or recorded cash/COD).
CREATE TABLE "OrderPayment" (
  "id"                TEXT NOT NULL,
  "tenantId"          TEXT NOT NULL,
  "salesOrderId"      TEXT NOT NULL,
  "amount"            DOUBLE PRECISION NOT NULL,
  "currency"          TEXT NOT NULL DEFAULT 'INR',
  "method"            TEXT NOT NULL DEFAULT 'UPI',
  "provider"          TEXT NOT NULL DEFAULT 'RAZORPAY',
  "status"            TEXT NOT NULL DEFAULT 'CREATED',
  "providerOrderId"   TEXT,
  "providerPaymentId" TEXT,
  "signature"         TEXT,
  "notes"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderPayment_tenantId_salesOrderId_idx" ON "OrderPayment" ("tenantId", "salesOrderId");
CREATE UNIQUE INDEX "OrderPayment_tenantId_providerOrderId_key" ON "OrderPayment" ("tenantId", "providerOrderId");

ALTER TABLE "OrderPayment"
  ADD CONSTRAINT "OrderPayment_salesOrderId_fkey"
  FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
