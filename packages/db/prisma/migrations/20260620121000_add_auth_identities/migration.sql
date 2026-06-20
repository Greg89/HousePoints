-- Allow one HousePoints user to be reached by multiple Auth0 identities
-- such as Google and GitHub social logins that share the same email address.
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthIdentity_providerSubject_key" ON "AuthIdentity"("providerSubject");
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

ALTER TABLE "AuthIdentity"
ADD CONSTRAINT "AuthIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AuthIdentity" ("id", "userId", "providerSubject", "createdAt", "updatedAt")
SELECT
    concat('auth_', md5("id" || ':' || "auth0Sub")),
    "id",
    "auth0Sub",
    "createdAt",
    "updatedAt"
FROM "User"
ON CONFLICT ("providerSubject") DO NOTHING;
