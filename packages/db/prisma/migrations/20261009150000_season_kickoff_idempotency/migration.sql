ALTER TABLE "Season"
  ADD CONSTRAINT "Season_organizationId_id_key" UNIQUE ("organizationId", "id");

CREATE TABLE "SeasonTransition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "planVersion" INTEGER NOT NULL,
  "previousSeasonId" TEXT NOT NULL,
  "activeSeasonId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SeasonTransition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonTransition_activeSeasonId_key"
  ON "SeasonTransition"("activeSeasonId");
CREATE UNIQUE INDEX "SeasonTransition_organizationId_idempotencyKey_key"
  ON "SeasonTransition"("organizationId", "idempotencyKey");
CREATE INDEX "SeasonTransition_organizationId_createdAt_idx"
  ON "SeasonTransition"("organizationId", "createdAt");
CREATE INDEX "SeasonTransition_organizationId_previousSeasonId_idx"
  ON "SeasonTransition"("organizationId", "previousSeasonId");

ALTER TABLE "SeasonTransition"
  ADD CONSTRAINT "SeasonTransition_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeasonTransition"
  ADD CONSTRAINT "SeasonTransition_organizationId_previousSeasonId_fkey"
  FOREIGN KEY ("organizationId", "previousSeasonId")
  REFERENCES "Season"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SeasonTransition"
  ADD CONSTRAINT "SeasonTransition_organizationId_activeSeasonId_fkey"
  FOREIGN KEY ("organizationId", "activeSeasonId")
  REFERENCES "Season"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
