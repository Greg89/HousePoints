-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
    'MEMBER_NEEDS_HOUSE_ASSIGNMENT',
    'INVITE_ACCEPTED',
    'ROLE_CHANGED',
    'SEASON_STARTED',
    'POINT_AWARD_RECEIVED',
    'POINT_DEDUCTION_RECEIVED'
);

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM (
    'INFO',
    'ACTION_REQUIRED',
    'WARNING'
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionHref" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_recipientUserId_dedupeKey_key"
ON "Notification"("recipientUserId", "dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_readAt_createdAt_idx"
ON "Notification"("recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_organizationId_type_createdAt_idx"
ON "Notification"("organizationId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
