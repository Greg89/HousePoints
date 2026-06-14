-- AlterEnum: add OWNER to Role
ALTER TYPE "Role" ADD VALUE 'OWNER';

-- AlterTable: make organizationId nullable on User (existing rows keep their value)
ALTER TABLE "User" ALTER COLUMN "organizationId" DROP NOT NULL;

-- CreateTable: OrgInvite
CREATE TABLE "OrgInvite" (
    "id"             TEXT         NOT NULL,
    "organizationId" TEXT         NOT NULL,
    "tokenHash"      TEXT         NOT NULL,
    "createdById"    TEXT         NOT NULL,
    "expiresAt"      TIMESTAMP(3) NOT NULL,
    "usedAt"         TIMESTAMP(3),
    "usedById"       TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgInvite_tokenHash_key" ON "OrgInvite"("tokenHash");
CREATE INDEX "OrgInvite_organizationId_idx" ON "OrgInvite"("organizationId");
CREATE INDEX "OrgInvite_tokenHash_idx" ON "OrgInvite"("tokenHash");

-- AddForeignKey
ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_usedById_fkey"
    FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
