CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "organizationCreationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxActiveOrganizations" INTEGER,
    "updatedByAuth0Sub" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAuditEvent" (
    "id" TEXT NOT NULL,
    "actorAuth0Sub" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformAuditEvent_createdAt_idx" ON "PlatformAuditEvent"("createdAt");
CREATE INDEX "PlatformAuditEvent_actorAuth0Sub_createdAt_idx" ON "PlatformAuditEvent"("actorAuth0Sub", "createdAt");

ALTER TABLE "PlatformSettings"
ADD CONSTRAINT "PlatformSettings_maxActiveOrganizations_check"
CHECK ("maxActiveOrganizations" IS NULL OR "maxActiveOrganizations" > 0);
