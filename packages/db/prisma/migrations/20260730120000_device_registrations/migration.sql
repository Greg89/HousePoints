-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM (
    'IOS',
    'ANDROID'
);

-- CreateTable
CREATE TABLE "DeviceRegistration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "pushToken" TEXT NOT NULL,
    "appVersion" TEXT,
    "locale" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceRegistration_userId_pushToken_key"
ON "DeviceRegistration"("userId", "pushToken");

-- CreateIndex
CREATE INDEX "DeviceRegistration_organizationId_userId_revokedAt_idx"
ON "DeviceRegistration"("organizationId", "userId", "revokedAt");

-- CreateIndex
CREATE INDEX "DeviceRegistration_revokedAt_idx"
ON "DeviceRegistration"("revokedAt");

-- AddForeignKey
ALTER TABLE "DeviceRegistration" ADD CONSTRAINT "DeviceRegistration_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceRegistration" ADD CONSTRAINT "DeviceRegistration_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
