ALTER TYPE "AuditEventType" ADD VALUE 'SEASON_PLAN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'SEASON_PLAN_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'SEASON_PLAN_DISCARDED';
ALTER TYPE "AuditEventType" ADD VALUE 'SEASON_PLANNED_END_UPDATED';

ALTER TABLE "Season"
  ADD COLUMN "plannedEndsAt" TIMESTAMP(3),
  ADD COLUMN "timezone" TEXT;

CREATE TABLE "SeasonPlan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kickoffMessage" TEXT,
  "plannedStartsAt" TIMESTAMP(3),
  "plannedEndsAt" TIMESTAMP(3),
  "timezone" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SeasonPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonPlan_organizationId_key"
  ON "SeasonPlan"("organizationId");
CREATE INDEX "SeasonPlan_createdById_idx"
  ON "SeasonPlan"("createdById");
CREATE INDEX "SeasonPlan_updatedById_idx"
  ON "SeasonPlan"("updatedById");

ALTER TABLE "SeasonPlan"
  ADD CONSTRAINT "SeasonPlan_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeasonPlan"
  ADD CONSTRAINT "SeasonPlan_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeasonPlan"
  ADD CONSTRAINT "SeasonPlan_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
