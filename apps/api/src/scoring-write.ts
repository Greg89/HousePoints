import type { Prisma } from "@prisma/client";
import { prisma } from "@housepoints/db";
import { ScoringWriteError, SeasonScopeError } from "./scoring-errors.js";
export { ScoringWriteError } from "./scoring-errors.js";

// Always acquire this before reading the season/cooldowns or locking ledger rows.
// NO KEY UPDATE permits unrelated foreign-key checks while serializing scores.
export async function lockOrganizationScoring(tx: Prisma.TransactionClient, organizationId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Organization" WHERE id = ${organizationId} FOR NO KEY UPDATE
  `;
  if (!rows.length) throw new ScoringWriteError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
}

export function withScoringWrite<T>(organizationId: string, write: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await lockOrganizationScoring(tx, organizationId);
    return write(tx);
  }, { isolationLevel: "ReadCommitted", maxWait: 5_000, timeout: 10_000 });
}

export async function activeScoringSeason(tx: Prisma.TransactionClient, organizationId: string) {
  const season = await tx.season.findFirst({
    where: { organizationId, isActive: true },
    select: { id: true, name: true, startsAt: true, endsAt: true, isActive: true },
  });
  if (!season) throw new SeasonScopeError(409, "ACTIVE_SEASON_REQUIRED", "An active season is required");
  return season;
}

// PostgreSQL now() is the transaction start, potentially BEFORE waiting for the
// org lock. Use the DB wall clock after acquisition for ordered season boundaries.
export async function scoringWriteTime(tx: Prisma.TransactionClient): Promise<Date> {
  const [row] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  return row.now;
}
