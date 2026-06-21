-- Add point-transaction soft deletion metadata. Deleted transactions remain
-- available for audit reports while score and activity reads ignore them.
ALTER TABLE "PointTransaction"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedByUserId" TEXT,
  ADD COLUMN "deletionReason" TEXT;

ALTER TABLE "PointTransaction"
  ADD CONSTRAINT "PointTransaction_deletedByUserId_fkey"
  FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PointTransaction_organizationId_deletedAt_idx"
  ON "PointTransaction"("organizationId", "deletedAt");

CREATE INDEX "PointTransaction_deletedByUserId_idx"
  ON "PointTransaction"("deletedByUserId");
