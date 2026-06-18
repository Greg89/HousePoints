-- CreateTable: Season
CREATE TABLE "Season" (
    "id"             TEXT         NOT NULL,
    "organizationId" TEXT         NOT NULL,
    "name"           TEXT         NOT NULL,
    "startsAt"       TIMESTAMP(3) NOT NULL,
    "endsAt"         TIMESTAMP(3),
    "isActive"       BOOLEAN      NOT NULL DEFAULT false,
    "createdById"    TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add nullable first so existing transactions can be backfilled safely.
ALTER TABLE "PointTransaction" ADD COLUMN "seasonId" TEXT;

-- Backfill one active Season 0 per organization.
INSERT INTO "Season" (
    "id",
    "organizationId",
    "name",
    "startsAt",
    "endsAt",
    "isActive",
    "createdById",
    "createdAt",
    "updatedAt"
)
SELECT
    'season0_' || org."id",
    org."id",
    'Season 0',
    COALESCE(MIN(tx."createdAt"), org."createdAt"),
    NULL,
    true,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Organization" org
LEFT JOIN "PointTransaction" tx ON tx."organizationId" = org."id"
GROUP BY org."id", org."createdAt";

-- Backfill all existing transactions into their organization's Season 0.
UPDATE "PointTransaction" tx
SET "seasonId" = 'season0_' || tx."organizationId"
WHERE tx."seasonId" IS NULL;

-- Enforce scoped ledger data from this migration forward.
ALTER TABLE "PointTransaction" ALTER COLUMN "seasonId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Season_organizationId_name_key" ON "Season"("organizationId", "name");
CREATE INDEX "Season_organizationId_isActive_idx" ON "Season"("organizationId", "isActive");
CREATE INDEX "Season_organizationId_startsAt_idx" ON "Season"("organizationId", "startsAt");
CREATE INDEX "Season_createdById_idx" ON "Season"("createdById");
CREATE UNIQUE INDEX "Season_one_active_per_org" ON "Season"("organizationId") WHERE "isActive" = true;
CREATE INDEX "PointTransaction_organizationId_seasonId_createdAt_idx" ON "PointTransaction"("organizationId", "seasonId", "createdAt");
CREATE INDEX "PointTransaction_targetHouseId_seasonId_createdAt_idx" ON "PointTransaction"("targetHouseId", "seasonId", "createdAt");
CREATE INDEX "PointTransaction_targetUserId_seasonId_createdAt_idx" ON "PointTransaction"("targetUserId", "seasonId", "createdAt");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Season" ADD CONSTRAINT "Season_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
