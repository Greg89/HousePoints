CREATE TYPE "PlatformSupportCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');
CREATE TYPE "PlatformSupportCasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "PlatformSupportCase" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "PlatformSupportCaseStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "PlatformSupportCasePriority" NOT NULL DEFAULT 'NORMAL',
  "organizationId" TEXT,
  "userId" TEXT,
  "createdByAuth0Sub" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformSupportCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformSupportNote" (
  "id" TEXT NOT NULL,
  "supportCaseId" TEXT NOT NULL,
  "authorAuth0Sub" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformSupportNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformSupportCase_status_updatedAt_idx" ON "PlatformSupportCase"("status", "updatedAt");
CREATE INDEX "PlatformSupportCase_organizationId_updatedAt_idx" ON "PlatformSupportCase"("organizationId", "updatedAt");
CREATE INDEX "PlatformSupportCase_userId_updatedAt_idx" ON "PlatformSupportCase"("userId", "updatedAt");
CREATE INDEX "PlatformSupportNote_supportCaseId_createdAt_idx" ON "PlatformSupportNote"("supportCaseId", "createdAt");

ALTER TABLE "PlatformSupportCase" ADD CONSTRAINT "PlatformSupportCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformSupportCase" ADD CONSTRAINT "PlatformSupportCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformSupportNote" ADD CONSTRAINT "PlatformSupportNote_supportCaseId_fkey" FOREIGN KEY ("supportCaseId") REFERENCES "PlatformSupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
