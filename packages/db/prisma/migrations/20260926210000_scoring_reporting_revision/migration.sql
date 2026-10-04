-- Additive baseline: existing score history starts at revision 0. Subsequent
-- committed ledger/season row changes invalidate revision-bound reports.
ALTER TABLE "Organization" ADD COLUMN "reportingRevision" BIGINT NOT NULL DEFAULT 0;

CREATE FUNCTION advance_scoring_reporting_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  affected_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  -- Sort when a maintenance operation moves a row between organizations.
  FOR affected_id IN
    SELECT DISTINCT org_id FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD."organizationId" ELSE NULL END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW."organizationId" ELSE NULL END
    ]) AS affected(org_id) WHERE org_id IS NOT NULL ORDER BY org_id
  LOOP
    UPDATE "Organization" SET "reportingRevision" = "reportingRevision" + 1
    WHERE id = affected_id;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER point_scoring_reporting_revision
AFTER INSERT OR UPDATE OR DELETE ON "PointTransaction"
FOR EACH ROW EXECUTE FUNCTION advance_scoring_reporting_revision();

CREATE TRIGGER season_scoring_reporting_revision
AFTER INSERT OR UPDATE OR DELETE ON "Season"
FOR EACH ROW EXECUTE FUNCTION advance_scoring_reporting_revision();
