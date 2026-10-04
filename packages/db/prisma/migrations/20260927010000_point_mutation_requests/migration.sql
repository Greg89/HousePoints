CREATE TABLE "PointMutationRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "resultId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PointMutationRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PointMutationRequest_operation_check" CHECK ("operation" IN ('AWARD', 'DEDUCTION')),
  CONSTRAINT "PointMutationRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PointMutationRequest_organizationId_actorUserId_operation_key_key" ON "PointMutationRequest"("organizationId", "actorUserId", "operation", "key");
CREATE INDEX "PointMutationRequest_expiresAt_idx" ON "PointMutationRequest"("expiresAt");
