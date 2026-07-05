DROP INDEX IF EXISTS "User_organizationId_idx";
DROP INDEX IF EXISTS "User_houseId_idx";

ALTER TABLE "User"
DROP CONSTRAINT IF EXISTS "User_organizationId_fkey",
DROP CONSTRAINT IF EXISTS "User_houseId_fkey";

ALTER TABLE "User"
DROP COLUMN IF EXISTS "organizationId",
DROP COLUMN IF EXISTS "role",
DROP COLUMN IF EXISTS "houseId";
