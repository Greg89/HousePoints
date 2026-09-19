CREATE TYPE "ModerationReportTargetType" AS ENUM ('USER', 'POINT_TRANSACTION');
CREATE TYPE "ModerationReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

CREATE TABLE "ModerationReport" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "reporterUserId" TEXT NOT NULL,
  "targetType" "ModerationReportTargetType" NOT NULL, "targetId" TEXT NOT NULL,
  "category" TEXT NOT NULL, "details" TEXT, "evidenceSnapshot" JSONB NOT NULL,
  "status" "ModerationReportStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModerationReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ModerationReport_status_createdAt_idx" ON "ModerationReport"("status", "createdAt");
CREATE INDEX "ModerationReport_organizationId_createdAt_idx" ON "ModerationReport"("organizationId", "createdAt");
CREATE INDEX "ModerationReport_targetType_targetId_createdAt_idx" ON "ModerationReport"("targetType", "targetId", "createdAt");
CREATE INDEX "ModerationReport_reporterUserId_createdAt_idx" ON "ModerationReport"("reporterUserId", "createdAt");
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
