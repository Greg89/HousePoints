ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ORG_ARCHIVED';

ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "archivedById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Organization_archivedById_fkey'
  ) THEN
    ALTER TABLE "Organization"
    ADD CONSTRAINT "Organization_archivedById_fkey"
    FOREIGN KEY ("archivedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Organization_archivedAt_idx" ON "Organization"("archivedAt");
CREATE INDEX IF NOT EXISTS "Organization_archivedById_idx" ON "Organization"("archivedById");
