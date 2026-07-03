import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const DEFAULT_DATABASE_POOL_MAX = 5;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set to initialize Prisma client");
}

const databasePoolMax = parseDatabasePoolMax(process.env.DATABASE_POOL_MAX);

const adapter = new PrismaPg(
  new Pool({
    connectionString: databaseUrl,
    max: databasePoolMax,
  }),
);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function parseDatabasePoolMax(value: string | undefined): number {
  if (!value) {
    return DEFAULT_DATABASE_POOL_MAX;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed.toString() !== value.trim()) {
    throw new Error("DATABASE_POOL_MAX must be a positive integer");
  }

  return parsed;
}
