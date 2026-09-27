ALTER TYPE "AuditEventType" ADD VALUE 'RECOGNITION_CATEGORY_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'RECOGNITION_CATEGORY_ARCHIVED';

ALTER TABLE "RecognitionCategory" ADD COLUMN "creationKey" TEXT;
CREATE UNIQUE INDEX "RecognitionCategory_organizationId_creationKey_key"
  ON "RecognitionCategory"("organizationId", "creationKey");

CREATE OR REPLACE FUNCTION enforce_recognition_category_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."name" := btrim(regexp_replace(NEW."name", '[[:space:]]+', ' ', 'g'));
  NEW."normalizedName" := lower(NEW."name");
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.id, NEW."organizationId", NEW."creationKey", NEW.name, NEW.description, NEW."legacyTrait", NEW."createdAt")
       IS DISTINCT FROM ROW(OLD.id, OLD."organizationId", OLD."creationKey", OLD.name, OLD.description, OLD."legacyTrait", OLD."createdAt") THEN
      RAISE EXCEPTION 'Recognition category identity, name and description are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD."archivedAt" IS NOT NULL AND NEW."archivedAt" IS DISTINCT FROM OLD."archivedAt" THEN
      RAISE EXCEPTION 'Archived recognition categories cannot be restored or re-dated' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE "PointTransaction"
  DROP CONSTRAINT "PointTransaction_award_trait_required_check";
ALTER TABLE "PointTransaction"
  ADD CONSTRAINT "PointTransaction_award_identity_required_check"
  CHECK (
    "type" <> 'AWARD'
    OR "trait" IS NOT NULL
    OR "categoryId" IS NOT NULL
  ) NOT VALID;
ALTER TABLE "PointTransaction"
  VALIDATE CONSTRAINT "PointTransaction_award_identity_required_check";