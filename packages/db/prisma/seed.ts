import "dotenv/config";
import { HouseName, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const houseNames = [
    HouseName.AURORA,
    HouseName.EMBER,
    HouseName.TIDE,
    HouseName.GROVE,
  ];

  for (const name of houseNames) {
    await prisma.house.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

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
