-- Prepare the append-only ledger for future negative point adjustments without
-- changing today's positive award behavior.
CREATE TYPE "PointTransactionType" AS ENUM ('AWARD', 'DEDUCTION');

ALTER TABLE "PointTransaction"
  ADD COLUMN "type" "PointTransactionType" NOT NULL DEFAULT 'AWARD';

ALTER TABLE "PointTransaction"
  DROP CONSTRAINT "PointTransaction_delta_positive_check";

ALTER TABLE "PointTransaction"
  DROP CONSTRAINT "PointTransaction_trait_required_check";

ALTER TABLE "PointTransaction"
  ADD CONSTRAINT "PointTransaction_delta_type_check"
  CHECK (
    ("type" = 'AWARD' AND "delta" > 0)
    OR ("type" = 'DEDUCTION' AND "delta" < 0)
  ) NOT VALID;

ALTER TABLE "PointTransaction"
  ADD CONSTRAINT "PointTransaction_award_trait_required_check"
  CHECK (
    "type" <> 'AWARD'
    OR "trait" IS NOT NULL
  ) NOT VALID;
