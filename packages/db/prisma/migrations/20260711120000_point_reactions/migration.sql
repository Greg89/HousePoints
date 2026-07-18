CREATE TABLE "PointReaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pointTransactionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "reactionKey" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointReaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PointReaction_organizationId_pointTransactionId_idx" ON "PointReaction"("organizationId", "pointTransactionId");
CREATE INDEX "PointReaction_actorUserId_updatedAt_idx" ON "PointReaction"("actorUserId", "updatedAt");

CREATE UNIQUE INDEX "PointReaction_one_active_per_actor_transaction"
ON "PointReaction" ("organizationId", "pointTransactionId", "actorUserId")
WHERE "deletedAt" IS NULL;

ALTER TABLE "PointReaction" ADD CONSTRAINT "PointReaction_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PointReaction" ADD CONSTRAINT "PointReaction_pointTransactionId_fkey"
FOREIGN KEY ("pointTransactionId") REFERENCES "PointTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PointReaction" ADD CONSTRAINT "PointReaction_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
