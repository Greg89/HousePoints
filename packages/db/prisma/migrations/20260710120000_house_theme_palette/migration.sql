CREATE TYPE "HouseThemeMode" AS ENUM ('GENERATED', 'CUSTOM');

ALTER TABLE "House"
  ADD COLUMN "themeMode" "HouseThemeMode" NOT NULL DEFAULT 'GENERATED',
  ADD COLUMN "themeSecondaryColor" TEXT,
  ADD COLUMN "themeSurfaceColor" TEXT;
