-- Expand + backfill atomically. Schedule a scoring-write maintenance window;
-- lock acquisition fails quickly instead of waiting indefinitely behind traffic.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE "Organization", "PointTransaction" IN ACCESS EXCLUSIVE MODE;

CREATE TABLE "RecognitionCategory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL DEFAULT '',
  "description" TEXT,
  "legacyTrait" "Trait",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "archivedAt" TIMESTAMP(3),
  "archivedById" TEXT,
  CONSTRAINT "RecognitionCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecognitionCategory_name_length_check" CHECK (length("name") BETWEEN 2 AND 60),
  CONSTRAINT "RecognitionCategory_description_length_check" CHECK (length("description") <= 240),
  CONSTRAINT "RecognitionCategory_archive_actor_check" CHECK ("archivedById" IS NULL OR "archivedAt" IS NOT NULL),
  CONSTRAINT "RecognitionCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecognitionCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RecognitionCategory_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RecognitionCategory_organizationId_id_key" ON "RecognitionCategory"("organizationId", "id");
CREATE UNIQUE INDEX "RecognitionCategory_organizationId_legacyTrait_key" ON "RecognitionCategory"("organizationId", "legacyTrait");
CREATE UNIQUE INDEX "RecognitionCategory_active_name_key" ON "RecognitionCategory"("organizationId", "normalizedName") WHERE "archivedAt" IS NULL;
CREATE INDEX "RecognitionCategory_organizationId_archivedAt_idx" ON "RecognitionCategory"("organizationId", "archivedAt");
CREATE INDEX "RecognitionCategory_createdById_idx" ON "RecognitionCategory"("createdById");
CREATE INDEX "RecognitionCategory_archivedById_idx" ON "RecognitionCategory"("archivedById");

CREATE FUNCTION enforce_recognition_category_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."name" := btrim(regexp_replace(NEW."name", '[[:space:]]+', ' ', 'g'));
  NEW."normalizedName" := lower(NEW."name");
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.id, NEW."organizationId", NEW.name, NEW.description, NEW."legacyTrait", NEW."createdAt")
       IS DISTINCT FROM ROW(OLD.id, OLD."organizationId", OLD.name, OLD.description, OLD."legacyTrait", OLD."createdAt") THEN
      RAISE EXCEPTION 'Recognition category identity, name and description are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD."archivedAt" IS NOT NULL AND NEW."archivedAt" IS DISTINCT FROM OLD."archivedAt" THEN
      RAISE EXCEPTION 'Archived recognition categories cannot be restored or re-dated' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER recognition_category_identity BEFORE INSERT OR UPDATE ON "RecognitionCategory"
FOR EACH ROW EXECUTE FUNCTION enforce_recognition_category_identity();

ALTER TABLE "PointTransaction" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_organizationId_categoryId_fkey"
  FOREIGN KEY ("organizationId", "categoryId") REFERENCES "RecognitionCategory"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_category_award_check" CHECK ("categoryId" IS NULL OR "type" = 'AWARD');
CREATE INDEX "PointTransaction_organizationId_categoryId_idx" ON "PointTransaction"("organizationId", "categoryId");

-- Versioned copy of the current TRAIT_LABELS, including Above & Beyond.
-- Called on organization INSERT and by explicit maintenance only, never on reads.
CREATE FUNCTION seed_recognition_categories(org_id TEXT) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO "RecognitionCategory" (id, "organizationId", name, "legacyTrait")
  SELECT gen_random_uuid()::text, org_id, defaults.name, defaults.trait::"Trait"
  FROM (VALUES
    ('LEADERSHIP', 'Leadership'), ('OWNERSHIP', 'Ownership'),
    ('COLLABORATION', 'Collaboration'), ('MENTORSHIP', 'Mentorship'),
    ('TECHNICAL_EXCELLENCE', 'Technical Excellence'), ('PROBLEM_SOLVING', 'Problem Solving'),
    ('INNOVATION', 'Innovation'), ('KNOWLEDGE_SHARING', 'Knowledge Sharing'),
    ('COMMUNICATION', 'Communication'), ('CUSTOMER_FOCUS', 'Customer Focus'),
    ('RELIABILITY', 'Reliability'), ('INITIATIVE', 'Initiative'),
    ('PROCESS_IMPROVEMENT', 'Process Improvement'), ('TEAM_SUPPORT', 'Team Support'),
    ('ACCOUNTABILITY', 'Accountability'), ('ADAPTABILITY', 'Adaptability'),
    ('POSITIVE_INFLUENCE', 'Positive Influence'), ('ABOVE_AND_BEYOND', 'Above & Beyond'),
    ('CULTURE_CHAMPION', 'Culture Champion'), ('UNSUNG_HERO', 'Unsung Hero')
  ) AS defaults(trait, name)
  WHERE NOT EXISTS (SELECT 1 FROM "RecognitionCategory" c WHERE c."organizationId" = org_id AND c."legacyTrait" = defaults.trait::"Trait")
  ON CONFLICT ("organizationId", "legacyTrait") DO NOTHING;
$$;
CREATE FUNCTION seed_new_organization_categories() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM seed_recognition_categories(NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER organization_recognition_categories AFTER INSERT ON "Organization"
FOR EACH ROW EXECUTE FUNCTION seed_new_organization_categories();

-- Safe to rerun after old writers have produced additional nullable references.
-- Existing references and archived mappings are never replaced or restored.
CREATE FUNCTION backfill_recognition_categories() RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
  org_id TEXT;
  changed BIGINT;
  total_changed BIGINT := 0;
BEGIN
  FOR org_id IN SELECT id FROM "Organization" ORDER BY id FOR NO KEY UPDATE LOOP
    IF EXISTS (SELECT 1 FROM "PointTransaction" WHERE "organizationId" = org_id AND type = 'AWARD' AND "categoryId" IS NULL AND trait IS NULL) THEN
      RAISE EXCEPTION 'Cannot backfill awards without a legacy trait in organization %', org_id USING ERRCODE = '23514';
    END IF;
    PERFORM seed_recognition_categories(org_id);
    UPDATE "PointTransaction" p SET "categoryId" = c.id FROM "RecognitionCategory" c
    WHERE p."organizationId" = org_id AND p.type = 'AWARD' AND p."categoryId" IS NULL
      AND c."organizationId" = p."organizationId" AND c."legacyTrait" = p.trait;
    GET DIAGNOSTICS changed = ROW_COUNT;
    total_changed := total_changed + changed;
    IF EXISTS (SELECT 1 FROM "PointTransaction" WHERE "organizationId" = org_id AND type = 'AWARD' AND "categoryId" IS NULL) THEN
      RAISE EXCEPTION 'Unmapped awards remain in organization %', org_id USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN total_changed;
END;
$$;
SELECT backfill_recognition_categories();
COMMIT;
