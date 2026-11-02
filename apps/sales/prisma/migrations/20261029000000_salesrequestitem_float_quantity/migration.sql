-- Portal weight orders (e.g. 0.75 kg of produce) were truncated to an integer
-- because SalesRequestItem.quantity was Int. Widen to double precision (lossless
-- for existing integer values, no backfill required).

ALTER TABLE "SalesRequestItem"
  ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;
