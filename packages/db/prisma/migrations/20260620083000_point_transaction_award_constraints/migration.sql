-- Enforce the settled invariants for today's point-award ledger entries.
-- NOT VALID avoids blocking deploys if older legacy rows predate these rules;
-- PostgreSQL still enforces these constraints for new and updated rows.
ALTER TABLE "PointTransaction"
  ADD CONSTRAINT "PointTransaction_delta_positive_check"
  CHECK ("delta" > 0) NOT VALID;

ALTER TABLE "PointTransaction"
  ADD CONSTRAINT "PointTransaction_trait_required_check"
  CHECK ("trait" IS NOT NULL) NOT VALID;

ALTER TABLE "PointTransaction"
  ADD CONSTRAINT "PointTransaction_reason_min_length_check"
  CHECK (length(btrim("reason")) >= 3) NOT VALID;
