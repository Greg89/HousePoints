CREATE TABLE "OrganizationErrorSignal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourcePath" TEXT,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationErrorSignal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrganizationErrorSignal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrganizationErrorSignal_organizationId_fingerprint_key" ON "OrganizationErrorSignal"("organizationId", "fingerprint");
CREATE INDEX "OrganizationErrorSignal_organizationId_lastSeenAt_idx" ON "OrganizationErrorSignal"("organizationId", "lastSeenAt");
