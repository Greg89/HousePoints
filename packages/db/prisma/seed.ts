import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const organizationSlug = process.env.DEFAULT_ORGANIZATION_SLUG ?? "default";
  const organizationName = process.env.DEFAULT_ORGANIZATION_NAME ?? "Default Org";
  const houseNames = ["Aurora", "Ember", "Tide", "Grove"];

  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: { name: organizationName },
    create: {
      slug: organizationSlug,
      name: organizationName,
    },
  });

  for (const name of houseNames) {
    await prisma.house.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name,
        },
      },
      update: {},
      create: {
        name,
        organizationId: organization.id,
      },
    });
  }

  console.log("Seeded organization:", organization.slug);
  console.log("Seeded houses:", houseNames.join(", "));
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
