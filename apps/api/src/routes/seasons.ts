import type { FastifyInstance } from "fastify";
import {
  actorScopeSchema,
  createSeasonSchema,
  renameSeasonSchema,
  seasonCompareRequestSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import type { ActorRecord } from "../actor.js";
import { SeasonScopeError, mapSeason } from "../season-scope.js";
import { parseBody, requireActor, requireOwnerActor } from "../route-helpers.js";
import { info, warn } from "../logging.js";
import { buildSeasonStartedNotificationData } from "../notifications.js";

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

type SeasonRecord = {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
};

type HouseRecord = {
  id: string;
  name: string;
  color: string;
};

type HouseMetric = {
  rank: number;
  points: number;
  transactions: number;
  averagePointsPerDay: number;
  topContributor: {
    userId: string;
    displayName: string;
    points: number;
  } | null;
};

const DAY_MS = 86_400_000;

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function seasonActiveDays(season: SeasonRecord, now = new Date()): number {
  const endsAt = season.endsAt ?? now;
  return Math.max(1, Math.ceil((endsAt.getTime() - season.startsAt.getTime()) / DAY_MS));
}

function seasonHouseKey(seasonId: string, houseId: string): string {
  return `${seasonId}:${houseId}`;
}

function buildRanks(
  houses: HouseRecord[],
  pointsByHouseId: Map<string, number>,
): Map<string, number> {
  const ranked = [...houses].sort((a, b) => {
    const pointDelta = (pointsByHouseId.get(b.id) ?? 0) - (pointsByHouseId.get(a.id) ?? 0);

    if (pointDelta !== 0) {
      return pointDelta;
    }

    return a.name.localeCompare(b.name);
  });

  return new Map(ranked.map((house, index) => [house.id, index + 1]));
}

export async function loadSeasonsForOrg(organizationId: string) {
  return prisma.season.findMany({
    where: { organizationId },
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, startsAt: true, endsAt: true, isActive: true },
  });
}

export async function loadSeasonCompareData(
  organizationId: string,
  seasonIds: string[],
) {
  return prisma.season.findMany({
    where: { id: { in: seasonIds }, organizationId },
    select: { id: true, name: true, startsAt: true, endsAt: true, isActive: true },
  });
}

export async function loadSeasonCompareDetails(
  organizationId: string,
  seasonIds: string[],
) {
  const [houses, houseTotals, contributorTotals] = await Promise.all([
    prisma.house.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.pointTransaction.groupBy({
      by: ["seasonId", "targetHouseId"],
      where: { organizationId, seasonId: { in: seasonIds }, deletedAt: null },
      _sum: { delta: true },
      _count: { _all: true },
    }),
    prisma.pointTransaction.groupBy({
      by: ["seasonId", "targetHouseId", "targetUserId"],
      where: { organizationId, seasonId: { in: seasonIds }, deletedAt: null, targetUserId: { not: null } },
      _sum: { delta: true },
    }),
  ]);
  return { houses, houseTotals, contributorTotals };
}

export async function loadContributorNames(
  userIds: string[],
  organizationId: string,
) {
  if (!userIds.length) return [];
  return prisma.user.findMany({
    where: { id: { in: userIds }, organizationId },
    select: { id: true, displayName: true },
  });
}

export async function startSeasonTransaction(actor: ActorRecord, seasonName: string) {
  return prisma.$transaction(async (tx) => {
    const currentSeason = await tx.season.findFirst({
      where: { organizationId: actor.organizationId, isActive: true },
      select: { id: true, name: true, startsAt: true, endsAt: true, isActive: true },
    });

    if (!currentSeason) {
      throw new SeasonScopeError(409, "ACTIVE_SEASON_REQUIRED", "An active season is required");
    }

    const now = new Date();
    const previousSeason = await tx.season.update({
      where: { id: currentSeason.id },
      data: { isActive: false, endsAt: now },
      select: { id: true, name: true, startsAt: true, endsAt: true, isActive: true },
    });
    const activeSeason = await tx.season.create({
      data: {
        organizationId: actor.organizationId,
        name: seasonName,
        startsAt: now,
        isActive: true,
        createdById: actor.id,
      },
      select: { id: true, name: true, startsAt: true, endsAt: true, isActive: true },
    });

    await tx.auditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        eventType: "SEASON_STARTED",
        summary: `${actor.displayName} started ${activeSeason.name}.`,
        metadata: {
          seasonId: activeSeason.id,
          seasonName: activeSeason.name,
          previousSeasonId: previousSeason.id,
          previousSeasonName: previousSeason.name,
        },
      },
    });

    const notificationRecipients = await tx.user.findMany({
      where: { organizationId: actor.organizationId },
      select: { id: true },
    });

    if (notificationRecipients.length > 0) {
      await tx.notification.createMany({
        data: notificationRecipients.map((recipient) => buildSeasonStartedNotificationData({
          organizationId: actor.organizationId,
          recipientId: recipient.id,
          actorDisplayName: actor.displayName,
          seasonName: activeSeason.name,
          seasonId: activeSeason.id,
        })),
        skipDuplicates: true,
      });
    }

    return { previousSeason, activeSeason };
  });
}

export async function findSeasonForOrg(seasonId: string, organizationId: string) {
  return prisma.season.findFirst({
    where: { id: seasonId, organizationId },
    select: { id: true },
  });
}

export async function renameSeasonInDb(seasonId: string, name: string) {
  return prisma.season.update({
    where: { id: seasonId },
    data: { name },
    select: { id: true, name: true, startsAt: true, endsAt: true, isActive: true },
  });
}

export async function registerSeasonRoutes(app: FastifyInstance): Promise<void> {
  app.post("/seasons/context", async (request, reply) => {
    const parsed = await parseBody(actorScopeSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const seasons = await loadSeasonsForOrg(actor.organizationId);
    const activeSeason = seasons.find((season) => season.isActive);

    if (!activeSeason) {
      warn(request.log, "seasons.active_missing", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
      });
      return reply.status(409).send({
        message: "An active season is required",
        code: "ACTIVE_SEASON_REQUIRED",
      });
    }

    info(request.log, "seasons.context.loaded", {
      organizationId: actor.organizationId,
      seasons: seasons.length,
      activeSeasonId: activeSeason.id,
    });

    return {
      activeSeason: mapSeason(activeSeason),
      seasons: seasons.map(mapSeason),
    };
  });

  app.post("/seasons/compare", async (request, reply) => {
    const parsed = await parseBody(seasonCompareRequestSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const requestedSeasonIds = [parsed.fromSeasonId, parsed.toSeasonId];
    const seasons = await loadSeasonCompareData(actor.organizationId, requestedSeasonIds);
    const seasonsById = new Map(seasons.map((season) => [season.id, season]));
    const fromSeason = seasonsById.get(parsed.fromSeasonId);
    const toSeason = seasonsById.get(parsed.toSeasonId);

    if (!fromSeason || !toSeason) {
      warn(request.log, "seasons.not_found", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        fromSeasonId: parsed.fromSeasonId,
        toSeasonId: parsed.toSeasonId,
      });
      return reply.status(404).send({ message: "Season not found", code: "SEASON_NOT_FOUND" });
    }

    const { houses, houseTotals, contributorTotals } = await loadSeasonCompareDetails(
      actor.organizationId,
      requestedSeasonIds,
    );

    const userIds = [
      ...new Set(
        contributorTotals
          .map((row) => row.targetUserId)
          .filter((userId): userId is string => Boolean(userId)),
      ),
    ];
    const users = await loadContributorNames(userIds, actor.organizationId);
    const userNamesById = new Map(users.map((user) => [user.id, user.displayName]));

    const totalsBySeasonHouse = new Map<string, { points: number; transactions: number }>();
    const pointsBySeason = new Map<string, Map<string, number>>([
      [fromSeason.id, new Map()],
      [toSeason.id, new Map()],
    ]);

    for (const row of houseTotals) {
      const points = row._sum.delta ?? 0;
      totalsBySeasonHouse.set(seasonHouseKey(row.seasonId, row.targetHouseId), {
        points,
        transactions: row._count._all,
      });
      pointsBySeason.get(row.seasonId)?.set(row.targetHouseId, points);
    }

    const topContributorsBySeasonHouse = new Map<string, HouseMetric["topContributor"]>();

    for (const row of contributorTotals) {
      if (!row.targetUserId) {
        continue;
      }

      const points = row._sum.delta ?? 0;
      const displayName = userNamesById.get(row.targetUserId);

      if (!displayName) {
        continue;
      }

      const key = seasonHouseKey(row.seasonId, row.targetHouseId);
      const current = topContributorsBySeasonHouse.get(key);

      if (
        !current ||
        points > current.points ||
        (points === current.points && displayName.localeCompare(current.displayName) < 0)
      ) {
        topContributorsBySeasonHouse.set(key, {
          userId: row.targetUserId,
          displayName,
          points,
        });
      }
    }

    const fromRanks = buildRanks(houses, pointsBySeason.get(fromSeason.id) ?? new Map());
    const toRanks = buildRanks(houses, pointsBySeason.get(toSeason.id) ?? new Map());
    const fromDays = seasonActiveDays(fromSeason);
    const toDays = seasonActiveDays(toSeason);

    function metricFor(season: SeasonRecord, house: HouseRecord, ranks: Map<string, number>, days: number): HouseMetric {
      const key = seasonHouseKey(season.id, house.id);
      const totals = totalsBySeasonHouse.get(key) ?? { points: 0, transactions: 0 };

      return {
        rank: ranks.get(house.id) ?? houses.length,
        points: totals.points,
        transactions: totals.transactions,
        averagePointsPerDay: roundMetric(totals.points / days),
        topContributor: topContributorsBySeasonHouse.get(key) ?? null,
      };
    }

    const comparisonHouses = houses.map((house) => {
      const from = metricFor(fromSeason, house, fromRanks, fromDays);
      const to = metricFor(toSeason, house, toRanks, toDays);

      return {
        houseId: house.id,
        houseName: house.name,
        houseColor: house.color,
        from,
        to,
        delta: {
          rankChange: from.rank - to.rank,
          pointChange: to.points - from.points,
          averagePointsPerDayChange: roundMetric(to.averagePointsPerDay - from.averagePointsPerDay),
        },
      };
    });

    info(request.log, "seasons.compare.loaded", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      fromSeasonId: fromSeason.id,
      toSeasonId: toSeason.id,
      houses: comparisonHouses.length,
    });

    return {
      fromSeason: mapSeason(fromSeason),
      toSeason: mapSeason(toSeason),
      houses: comparisonHouses,
    };
  });

  app.post("/seasons/start", async (request, reply) => {
    const parsed = await parseBody(createSeasonSchema, request, reply);
    if (!parsed) return;

    const actor = await requireOwnerActor(request, reply);
    if (!actor) return;

    try {
      const transition = await startSeasonTransaction(actor, parsed.name);

      info(request.log, "seasons.started", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        previousSeasonId: transition.previousSeason.id,
        activeSeasonId: transition.activeSeason.id,
      });

      return {
        previousSeason: mapSeason(transition.previousSeason),
        activeSeason: mapSeason(transition.activeSeason),
      };
    } catch (err) {
      if (err instanceof SeasonScopeError) {
        warn(request.log, "seasons.active_missing", {
          actorUserId: actor.id,
          organizationId: actor.organizationId,
        });
        return reply.status(err.statusCode).send({ message: err.message, code: err.code });
      }

      if (isUniqueConstraintError(err)) {
        warn(request.log, "seasons.name_conflict", {
          actorUserId: actor.id,
          organizationId: actor.organizationId,
          seasonName: parsed.name,
        });
        return reply.status(409).send({
          message: "A season with that name already exists",
          code: "SEASON_NAME_TAKEN",
        });
      }

      throw err;
    }
  });

  app.post("/seasons/rename", async (request, reply) => {
    const parsed = await parseBody(renameSeasonSchema, request, reply);
    if (!parsed) return;

    const actor = await requireOwnerActor(request, reply);
    if (!actor) return;

    const season = await findSeasonForOrg(parsed.seasonId, actor.organizationId);

    if (!season) {
      warn(request.log, "seasons.not_found", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        seasonId: parsed.seasonId,
      });
      return reply.status(404).send({ message: "Season not found", code: "SEASON_NOT_FOUND" });
    }

    try {
      const updatedSeason = await renameSeasonInDb(season.id, parsed.name);

      info(request.log, "seasons.renamed", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        seasonId: updatedSeason.id,
      });

      return mapSeason(updatedSeason);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        warn(request.log, "seasons.name_conflict", {
          actorUserId: actor.id,
          organizationId: actor.organizationId,
          seasonId: parsed.seasonId,
          seasonName: parsed.name,
        });
        return reply.status(409).send({
          message: "A season with that name already exists",
          code: "SEASON_NAME_TAKEN",
        });
      }

      throw err;
    }
  });
}
