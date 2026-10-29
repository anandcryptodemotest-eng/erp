-- Support weight-based (sell-by-weight) order lines, e.g. 0.5 kg of produce.
-- Widen integer quantity columns to double precision. This is a lossless cast
-- for all existing integer values, so no data migration is required.

ALTER TABLE "SalesOrderItem"
  ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
  ALTER COLUMN "shippedQty" SET DATA TYPE DOUBLE PRECISION;

ALTER TABLE "SalesReturnItem"
  ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;
