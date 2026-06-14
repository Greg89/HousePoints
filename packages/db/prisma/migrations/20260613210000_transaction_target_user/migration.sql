-- AlterTable: add targetUserId (nullable for backward compat with existing rows)
ALTER TABLE "PointTransaction" ADD COLUMN "targetUserId" TEXT;

-- AlterIndex: replace old targetHouseId index with targetUserId index
CREATE INDEX "PointTransaction_targetUserId_createdAt_idx" ON "PointTransaction"("targetUserId", "createdAt");
