-- CreateTable: OrganizationSlugAlias
CREATE TABLE "OrganizationSlugAlias" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationSlugAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSlugAlias_slug_key" ON "OrganizationSlugAlias"("slug");

-- CreateIndex
CREATE INDEX "OrganizationSlugAlias_organizationId_idx" ON "OrganizationSlugAlias"("organizationId");

-- CreateIndex: at most one primary slug alias per organization
CREATE UNIQUE INDEX "OrganizationSlugAlias_organizationId_primary_key"
ON "OrganizationSlugAlias"("organizationId")
WHERE "isPrimary" = true;

-- Backfill current organization slugs as primary aliases.
INSERT INTO "OrganizationSlugAlias" ("id", "organizationId", "slug", "isPrimary", "createdAt")
SELECT
    'slug_alias_' || md5("id" || ':' || "slug"),
    "id",
    "slug",
    true,
    CURRENT_TIMESTAMP
FROM "Organization";

-- AddForeignKey
ALTER TABLE "OrganizationSlugAlias" ADD CONSTRAINT "OrganizationSlugAlias_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
