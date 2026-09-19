ALTER TABLE "User"
ADD COLUMN "deletionCompletedAt" TIMESTAMP(3),
ADD COLUMN "deletionCompletedByAuth0Sub" TEXT,
ADD COLUMN "deletionCompletionNote" TEXT,
ADD COLUMN "deletionCompletionEvidence" JSONB;

CREATE INDEX "User_deletionCompletedAt_idx" ON "User"("deletionCompletedAt");
