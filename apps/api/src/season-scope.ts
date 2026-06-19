import type { ActorRecord } from "./actor.js";
import { prisma } from "@housepoints/db";

export class SeasonScopeError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: "SEASON_NOT_FOUND" | "ACTIVE_SEASON_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "SeasonScopeError";
  }
}

export function mapSeason(season: {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
}) {
  return {
    id: season.id,
    name: season.name,
    startsAt: season.startsAt.toISOString(),
    endsAt: season.endsAt?.toISOString() ?? null,
    isActive: season.isActive,
  };
}

export async function resolveSeasonScope(
  actor: ActorRecord,
  requestedSeasonId?: string,
) {
  if (requestedSeasonId) {
    const requestedSeason = await prisma.season.findFirst({
      where: {
        id: requestedSeasonId,
        organizationId: actor.organizationId,
      },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        isActive: true,
      },
    });

    if (!requestedSeason) {
      throw new SeasonScopeError(404, "SEASON_NOT_FOUND", "Season not found");
    }

    return requestedSeason;
  }

  const activeSeason = await prisma.season.findFirst({
    where: {
      organizationId: actor.organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      isActive: true,
    },
  });

  if (!activeSeason) {
    throw new SeasonScopeError(409, "ACTIVE_SEASON_REQUIRED", "An active season is required");
  }

  return activeSeason;
}
