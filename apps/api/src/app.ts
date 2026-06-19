import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {
  actorScopeSchema,
  seasonScopedRequestSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { getActorBySub } from "./actor.js";
import {
  createAuth0AccessTokenVerifierFromEnv,
  type VerifyAccessToken,
} from "./auth.js";
import {
  registerAuthenticationHook,
  registerRequestLifecycleHooks,
} from "./api-hooks.js";
import { readCorsAllowedOriginsFromEnv } from "./config.js";
import { createApiLogger, info, warn } from "./logging.js";
import {
  mapSeason,
  resolveSeasonScope,
  SeasonScopeError,
} from "./season-scope.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerOrgRoutes } from "./routes/orgs.js";
import { mapActivityItem, registerPointRoutes } from "./routes/points.js";
import { registerSeasonRoutes } from "./routes/seasons.js";
import { registerUserRoutes } from "./routes/users.js";

function utcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function lastUtcDateKeys(days: number, now: Date) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (days - 1 - index));
    return utcDateKey(date);
  });
}

type BuildAppOptions = {
  verifyAccessToken?: VerifyAccessToken;
  corsAllowedOrigins?: readonly string[];
};

export async function buildApp(options: BuildAppOptions = {}) {
  const apiLogger = createApiLogger();
  const verifyAccessToken =
    options.verifyAccessToken ?? createAuth0AccessTokenVerifierFromEnv();
  const corsAllowedOrigins =
    options.corsAllowedOrigins ?? readCorsAllowedOriginsFromEnv();
  const app = Fastify({
    loggerInstance: apiLogger.logger,
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
    disableRequestLogging: true,
  });

  app.addHook("onClose", async () => {
    await apiLogger.close();
  });

  await app.register(cors, {
    origin: [...corsAllowedOrigins],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type", "x-request-id"],
    maxAge: 600,
  });

  registerAuthenticationHook(app, verifyAccessToken);

  await app.register(rateLimit, {
    global: true,
    max: 60,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      code: "RATE_LIMITED",
      message: "Too many requests â€” please slow down.",
    }),
  });

  registerRequestLifecycleHooks(app);

  await registerHealthRoutes(app);
  await registerSeasonRoutes(app);
  await registerAdminRoutes(app);
  await registerOrgRoutes(app);
  await registerUserRoutes(app);
  await registerPointRoutes(app);

app.post("/houses/leaderboard", async (request, reply) => {
  const parsed = actorScopeSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);

  if (!actor) {
    warn(request.log, "points.actor_not_found", {});
    return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
  }

  let season;
  try {
    season = await resolveSeasonScope(actor);
  } catch (err) {
    if (err instanceof SeasonScopeError) {
      warn(request.log, "seasons.active_missing", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
      });
      return reply.status(err.statusCode).send({ message: err.message, code: err.code });
    }
    throw err;
  }

  const houses = await prisma.house.findMany({
    where: {
      organizationId: actor.organizationId,
    },
    select: {
      id: true,
      name: true,
      color: true,
      description: true,
      _count: {
        select: {
          transactions: true,
          users: true,
        },
      },
      transactions: {
        where: {
          seasonId: season.id,
        },
        select: {
          delta: true,
        },
      },
    },
  });

  const leaderboard = houses
    .map((house) => ({
      id: house.id,
      name: house.name,
      color: house.color,
      description: house.description,
      score: house.transactions.reduce((total, tx) => total + tx.delta, 0),
      transactions: house.transactions.length,
      memberCount: house._count.users,
    }))
    .sort((a, b) => b.score - a.score);

  info(request.log, "leaderboard.fetched", {
    organizationId: actor.organizationId,
    seasonId: season.id,
    houses: leaderboard.length,
  });

  return leaderboard;
});

app.post("/dashboard/summary", async (request, reply) => {
  const parsed = seasonScopedRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);

  if (!actor) {
    warn(request.log, "points.actor_not_found", {});
    return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
  }

  let season;
  try {
    season = await resolveSeasonScope(actor, parsed.data.seasonId);
  } catch (err) {
    if (err instanceof SeasonScopeError) {
      warn(request.log, err.code === "SEASON_NOT_FOUND" ? "seasons.not_found" : "seasons.active_missing", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        seasonId: parsed.data.seasonId,
      });
      return reply.status(err.statusCode).send({ message: err.message, code: err.code });
    }
    throw err;
  }

  const now = new Date();
  const velocityDates = lastUtcDateKeys(14, now);
  const velocityStartsAt = new Date(`${velocityDates[0]}T00:00:00.000Z`);

  const [
    houses,
    monthlyMemberTotals,
    monthlyTraitTotals,
    recentTransactions,
    velocityTransactions,
    memberTotals,
    members,
  ] = await Promise.all([
    prisma.house.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.pointTransaction.groupBy({
      by: ["targetUserId", "targetHouseId"],
      where: {
        organizationId: actor.organizationId,
        seasonId: season.id,
        targetUserId: { not: null },
      },
      _sum: { delta: true },
    }),
    prisma.pointTransaction.groupBy({
      by: ["targetHouseId", "trait"],
      where: {
        organizationId: actor.organizationId,
        seasonId: season.id,
        trait: { not: null },
      },
      _count: { trait: true },
    }),
    prisma.pointTransaction.findMany({
      where: {
        organizationId: actor.organizationId,
        seasonId: season.id,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        delta: true,
        reason: true,
        trait: true,
        createdAt: true,
        actor: { select: { displayName: true } },
        targetUser: { select: { displayName: true } },
        targetHouse: { select: { name: true, color: true } },
        season: { select: { id: true, name: true, isActive: true } },
      },
    }),
    prisma.pointTransaction.findMany({
      where: {
        organizationId: actor.organizationId,
        seasonId: season.id,
        createdAt: { gte: velocityStartsAt },
      },
      select: {
        targetHouseId: true,
        delta: true,
        createdAt: true,
      },
    }),
    prisma.pointTransaction.groupBy({
      by: ["targetUserId"],
      where: {
        organizationId: actor.organizationId,
        seasonId: season.id,
        targetUserId: { not: null },
      },
      _sum: { delta: true },
    }),
    prisma.user.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        role: true,
        houseId: true,
      },
    }),
  ]);

  const houseById = new Map(houses.map((house) => [house.id, house]));
  const memberById = new Map(members.map((member) => [member.id, member]));
  const memberPoints = new Map(
    memberTotals
      .filter((row) => row.targetUserId)
      .map((row) => [row.targetUserId as string, row._sum.delta ?? 0]),
  );

  function toStandout(row: (typeof monthlyMemberTotals)[number] | undefined) {
    if (!row?.targetUserId) return null;
    const member = memberById.get(row.targetUserId);
    const house = houseById.get(row.targetHouseId);
    if (!member || !house) return null;

    return {
      memberId: member.id,
      memberName: member.displayName,
      houseId: house.id,
      houseName: house.name,
      houseColor: house.color,
      points: row._sum.delta ?? 0,
    };
  }

  const monthlyMemberTotalsByMember = new Map<string, (typeof monthlyMemberTotals)[number]>();
  for (const row of monthlyMemberTotals.filter((entry) => entry.targetUserId)) {
    const existing = monthlyMemberTotalsByMember.get(row.targetUserId as string);
    if (!existing) {
      monthlyMemberTotalsByMember.set(row.targetUserId as string, row);
      continue;
    }

    monthlyMemberTotalsByMember.set(row.targetUserId as string, {
      ...existing,
      _sum: { delta: (existing._sum.delta ?? 0) + (row._sum.delta ?? 0) },
    });
  }

  const monthlyStandoutRow = Array.from(monthlyMemberTotalsByMember.values())
    .sort((a, b) => (b._sum.delta ?? 0) - (a._sum.delta ?? 0))[0];

  const traitLeaders = houses.map((house) => {
    const topTrait = monthlyTraitTotals
      .filter((row) => row.targetHouseId === house.id && row.trait)
      .sort((a, b) => b._count.trait - a._count.trait)[0];

    return {
      houseId: house.id,
      houseName: house.name,
      houseColor: house.color,
      trait: topTrait?.trait ?? null,
      count: topTrait?._count.trait ?? 0,
    };
  });

  const velocityPoints = new Map<string, Map<string, number>>();
  for (const house of houses) {
    velocityPoints.set(house.id, new Map(velocityDates.map((date) => [date, 0])));
  }
  for (const transaction of velocityTransactions) {
    const housePoints = velocityPoints.get(transaction.targetHouseId);
    if (!housePoints) continue;
    const key = utcDateKey(transaction.createdAt);
    if (!housePoints.has(key)) continue;
    housePoints.set(key, (housePoints.get(key) ?? 0) + transaction.delta);
  }

  const houseMemberRankings = houses.map((house) => ({
    houseId: house.id,
    members: members
      .filter((member) => member.houseId === house.id)
      .map((member) => ({
        memberId: member.id,
        displayName: member.displayName,
        role: member.role,
        points: memberPoints.get(member.id) ?? 0,
      }))
      .sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName)),
  }));

  info(request.log, "dashboard.summary.loaded", {
    organizationId: actor.organizationId,
    seasonId: season.id,
    houses: houses.length,
    recentActivity: recentTransactions.length,
  });

  const seasonStandout = toStandout(monthlyStandoutRow);
  const seasonStandoutsByHouse = houses.map((house) => ({
    houseId: house.id,
    standout: toStandout(
      monthlyMemberTotals
        .filter((row) => row.targetHouseId === house.id && row.targetUserId)
        .sort((a, b) => (b._sum.delta ?? 0) - (a._sum.delta ?? 0))[0],
    ),
  }));

  return {
    generatedAt: now.toISOString(),
    selectedSeason: mapSeason(season),
    seasonStartsAt: season.startsAt.toISOString(),
    seasonStandout,
    seasonStandoutsByHouse,
    monthStartsAt: season.startsAt.toISOString(),
    monthlyStandout: seasonStandout,
    monthlyStandoutsByHouse: seasonStandoutsByHouse,
    traitLeaders,
    recentActivity: recentTransactions.map(mapActivityItem),
    pointsVelocity: houses.map((house) => ({
      houseId: house.id,
      houseName: house.name,
      houseColor: house.color,
      days: velocityDates.map((date) => ({
        date,
        points: velocityPoints.get(house.id)?.get(date) ?? 0,
      })),
    })),
    houseMemberRankings,
  };
});

  return app;
}


