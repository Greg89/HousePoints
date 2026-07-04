CREATE TABLE "ReleaseAnnouncement" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "releaseNotesUrl" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL,
    "broadcastAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReleaseAnnouncement_version_key" ON "ReleaseAnnouncement"("version");
CREATE INDEX "ReleaseAnnouncement_releasedAt_idx" ON "ReleaseAnnouncement"("releasedAt");
CREATE INDEX "ReleaseAnnouncement_broadcastAt_idx" ON "ReleaseAnnouncement"("broadcastAt");
