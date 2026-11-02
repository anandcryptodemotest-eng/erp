-- Proof-of-delivery capture on a delivery assignment.
ALTER TABLE "DeliveryAssignment" ADD COLUMN IF NOT EXISTS "podPhotoUrl" TEXT;
ALTER TABLE "DeliveryAssignment" ADD COLUMN IF NOT EXISTS "podSignatureUrl" TEXT;
ALTER TABLE "DeliveryAssignment" ADD COLUMN IF NOT EXISTS "podRecipientName" TEXT;
ALTER TABLE "DeliveryAssignment" ADD COLUMN IF NOT EXISTS "podNotes" TEXT;
