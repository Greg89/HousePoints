ALTER TABLE "Organization"
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspendedByAuth0Sub" TEXT,
ADD COLUMN "suspensionReason" TEXT;

CREATE INDEX "Organization_suspendedAt_idx" ON "Organization"("suspendedAt");
