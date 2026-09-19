ALTER TABLE "ModerationReport"
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "resolvedByAuth0Sub" TEXT,
ADD COLUMN "operatorNote" TEXT;
