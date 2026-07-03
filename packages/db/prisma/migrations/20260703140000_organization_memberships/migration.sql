CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "houseId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key"
ON "OrganizationMembership"("organizationId", "userId");

CREATE INDEX "OrganizationMembership_userId_archivedAt_idx"
ON "OrganizationMembership"("userId", "archivedAt");

CREATE INDEX "OrganizationMembership_organizationId_role_idx"
ON "OrganizationMembership"("organizationId", "role");

CREATE INDEX "OrganizationMembership_organizationId_houseId_idx"
ON "OrganizationMembership"("organizationId", "houseId");

ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_houseId_fkey"
FOREIGN KEY ("houseId") REFERENCES "House"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "OrganizationMembership" (
    "id",
    "organizationId",
    "userId",
    "role",
    "houseId",
    "isActive",
    "archivedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    concat('mem_', md5("id" || ':' || "organizationId")),
    "organizationId",
    "id",
    "role",
    "houseId",
    true,
    NULL,
    "createdAt",
    "updatedAt"
FROM "User"
WHERE "organizationId" IS NOT NULL
ON CONFLICT ("organizationId", "userId") DO NOTHING;
