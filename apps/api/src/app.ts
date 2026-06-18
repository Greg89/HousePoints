import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {
  actorScopeSchema,
  adjustPointsSchema,
  assignUserHouseSchema,
  bootstrapUserSchema,
  createHouseSchema,
  createInviteSchema,
  createOrgSchema,
  joinOrgSchema,
  seasonScopedRequestSchema,
  type Trait,
  updateProfileSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import {
  createAuth0AccessTokenVerifierFromEnv,
  readBearerToken,
  type VerifyAccessToken,
} from "./auth.js";
import { readCorsAllowedOriginsFromEnv } from "./config.js";
import { createApiLogger, error, info, warn } from "./logging.js";

type ActorRecord = {
  id: string;
  auth0Sub: string;
  role: "MEMBER" | "ADMIN" | "OWNER";
  houseId: string | null;
  organizationId: string;
  organizationSlug: string;
};

import { createHash, randomBytes } from "node:crypto";

function generateInviteToken(): string {
  return randomBytes(32).toString("hex"); // 64-char hex string
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

type InviteJoinErrorCode =
  | "INVITE_NOT_FOUND"
  | "INVITE_USED"
  | "INVITE_EXPIRED"
  | "ALREADY_IN_ORG";

class InviteJoinError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: InviteJoinErrorCode,
    message: string,
    readonly inviteId?: string,
  ) {
    super(message);
    this.name = "InviteJoinError";
  }
}

class SeasonScopeError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: "SEASON_NOT_FOUND" | "ACTIVE_SEASON_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "SeasonScopeError";
  }
}

/** OWNER inherits all ADMIN privileges */
function isAdmin(role: "MEMBER" | "ADMIN" | "OWNER"): boolean {
  return role === "ADMIN" || role === "OWNER";
}

async function getActorBySub(auth0Sub: string): Promise<ActorRecord | null> {
  const actor = await prisma.user.findUnique({
    where: { auth0Sub },
    select: {
      id: true,
      auth0Sub: true,
      role: true,
      houseId: true,
      organizationId: true,
      organization: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!actor) {
    return null;
  }

  // Users without an org can't act on any org-scoped endpoint
  if (!actor.organizationId || !actor.organization) {
    return null;
  }

  return {
    id: actor.id,
    auth0Sub: actor.auth0Sub,
    role: actor.role,
    houseId: actor.houseId,
    organizationId: actor.organizationId,
    organizationSlug: actor.organization.slug,
  };
}

function mapAppUser(user: {
  id: string;
  auth0Sub: string;
  email: string | null;
  displayName: string;
  role: "MEMBER" | "ADMIN" | "OWNER";
  houseId: string | null;
  organizationId: string | null;
  organization: { slug: string } | null;
  house: { name: string; color: string } | null;
}) {
  return {
    id: user.id,
    auth0Sub: user.auth0Sub,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    organizationId: user.organizationId,
    organizationSlug: user.organization?.slug ?? null,
    houseId: user.houseId,
    houseName: user.house?.name ?? null,
    houseColor: user.house?.color ?? null,
  };
}

function startOfUtcMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

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

function mapActivityItem(tx: {
  id: string;
  actor: { displayName: string };
  targetUser: { displayName: string } | null;
  targetHouse: { name: string; color: string };
  delta: number;
  reason: string;
  trait: Trait | null;
  createdAt: Date;
}) {
  return {
    id: tx.id,
    actorName: tx.actor.displayName,
    targetUserName: tx.targetUser?.displayName ?? "Unknown",
    targetHouseName: tx.targetHouse.name,
    targetHouseColor: tx.targetHouse.color,
    delta: tx.delta,
    reason: tx.reason,
    trait: tx.trait ?? null,
    createdAt: tx.createdAt.toISOString(),
  };
}

function mapSeason(season: {
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

async function resolveSeasonScope(actor: ActorRecord, requestedSeasonId?: string) {
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

  app.decorateRequest("auth");

  app.addHook("preValidation", async (request, reply) => {
    if (request.routeOptions.url === "/health") {
      return;
    }

    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      warn(request.log, "auth.token_missing", {});
      return reply.status(401).send({
        code: "AUTHENTICATION_REQUIRED",
        message: "A valid bearer token is required",
      });
    }

    try {
      request.auth = await verifyAccessToken(token);
    } catch (err) {
      warn(request.log, "auth.token_invalid", {
        error: err instanceof Error ? err.message : "unknown",
      });
      return reply.status(401).send({
        code: "INVALID_ACCESS_TOKEN",
        message: "The access token is invalid or expired",
      });
    }

  });

await app.register(rateLimit, {
  global: true,
  max: 60,
  timeWindow: "1 minute",
  errorResponseBuilder: () => ({
    code: "RATE_LIMITED",
    message: "Too many requests â€” please slow down.",
  }),
});

app.addHook("onRequest", async (request) => {
  request.log = request.log.child({
    requestId: request.id,
    route: request.url,
    method: request.method,
  });

  info(request.log, "request.received", {
    query: request.query,
  });
});

app.addHook("onResponse", async (request, reply) => {
  info(request.log, "request.completed", {
    statusCode: reply.statusCode,
    durationMs: reply.elapsedTime,
  });
});

app.setErrorHandler(async (err, request, reply) => {
  error(request.log, "request.unhandled_error", { statusCode: 500 }, err);
  await reply.status(500).send({ code: "INTERNAL_ERROR", message: "Internal server error" });
});

app.get("/health", async (request) => {
  info(request.log, "health.checked", {});
  return { ok: true };
});

app.post("/seasons/context", async (request, reply) => {
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

  const seasons = await prisma.season.findMany({
    where: {
      organizationId: actor.organizationId,
    },
    orderBy: {
      startsAt: "desc",
    },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      isActive: true,
    },
  });
  const activeSeason = seasons.find((season) => season.isActive);

  if (!activeSeason) {
    error(request.log, "seasons.active_missing", {
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
      error(request.log, "seasons.active_missing", {
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

  const now = new Date();
  const monthStartsAt = startOfUtcMonth(now);
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
        targetUserId: { not: null },
        createdAt: { gte: monthStartsAt },
      },
      _sum: { delta: true },
    }),
    prisma.pointTransaction.groupBy({
      by: ["targetHouseId", "trait"],
      where: {
        organizationId: actor.organizationId,
        trait: { not: null },
        createdAt: { gte: monthStartsAt },
      },
      _count: { trait: true },
    }),
    prisma.pointTransaction.findMany({
      where: { organizationId: actor.organizationId },
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
      },
    }),
    prisma.pointTransaction.findMany({
      where: {
        organizationId: actor.organizationId,
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
    houses: houses.length,
    recentActivity: recentTransactions.length,
  });

  return {
    generatedAt: now.toISOString(),
    monthStartsAt: monthStartsAt.toISOString(),
    monthlyStandout: toStandout(monthlyStandoutRow),
    monthlyStandoutsByHouse: houses.map((house) => ({
      houseId: house.id,
      standout: toStandout(
        monthlyMemberTotals
          .filter((row) => row.targetHouseId === house.id && row.targetUserId)
          .sort((a, b) => (b._sum.delta ?? 0) - (a._sum.delta ?? 0))[0],
      ),
    })),
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

app.post("/users/bootstrap", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
  const parsed = bootstrapUserSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "users.bootstrap.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const userSelect = {
    id: true,
    auth0Sub: true,
    email: true,
    displayName: true,
    role: true,
    organizationId: true,
    organization: { select: { slug: true } },
    houseId: true,
    house: { select: { name: true, color: true } },
  } as const;

  const existing = await prisma.user.findUnique({
    where: { auth0Sub: request.auth.subject },
    select: userSelect,
  });

  if (existing) {
    info(request.log, "users.bootstrap.loaded", {
      userId: existing.id,
      auth0Sub: existing.auth0Sub,
      organizationId: existing.organizationId,
      hasHouse: Boolean(existing.houseId),
    });
    return { ...mapAppUser(existing), created: false };
  }

  // New user â€” no org yet. Create the User row without an org.
  // They must then create an org (POST /orgs/create) or join one (POST /orgs/join).
  const createdUser = await prisma.user.create({
    data: {
      auth0Sub: request.auth.subject,
      email: parsed.data.email ?? null,
      displayName: parsed.data.displayName,
    },
    select: userSelect,
  });

  info(request.log, "users.bootstrap.created", {
    userId: createdUser.id,
    auth0Sub: createdUser.auth0Sub,
    hasOrg: false,
  });

  return reply.status(201).send({ ...mapAppUser(createdUser), created: true });
});

app.post("/admin/context", async (request, reply) => {
  const parsed = actorScopeSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);

  if (!actor || !isAdmin(actor.role)) {
    warn(request.log, "admin.forbidden", {});
    return reply.status(403).send({ message: "Admin access required", code: "ADMIN_REQUIRED" });
  }

  const [users, houses] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        houseId: true,
      },
    }),
    prisma.house.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, description: true },
    }),
  ]);

  info(request.log, "admin.context.loaded", {
    actorUserId: actor.id,
    organizationId: actor.organizationId,
    users: users.length,
    houses: houses.length,
  });

  return {
    organizationId: actor.organizationId,
    organizationSlug: actor.organizationSlug,
    users,
    houses,
  };
});

app.post("/admin/houses", async (request, reply) => {
  const parsed = createHouseSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);

  if (!actor || !isAdmin(actor.role)) {
    warn(request.log, "admin.forbidden", {});
    return reply.status(403).send({ message: "Admin access required", code: "ADMIN_REQUIRED" });
  }

  const house = await prisma.house.upsert({
    where: {
      organizationId_name: {
        organizationId: actor.organizationId,
        name: parsed.data.name,
      },
    },
    update: {
      color: parsed.data.color,
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
    },
    create: {
      organizationId: actor.organizationId,
      name: parsed.data.name,
      color: parsed.data.color,
      description: parsed.data.description ?? null,
    },
    select: {
      id: true,
      name: true,
      color: true,
      description: true,
    },
  });

  info(request.log, "admin.house.created", {
    actorUserId: actor.id,
    organizationId: actor.organizationId,
    houseId: house.id,
    houseName: house.name,
  });

  return reply.status(201).send(house);
});

app.post("/admin/users/assign-house", async (request, reply) => {
  const parsed = assignUserHouseSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);

  if (!actor || !isAdmin(actor.role)) {
    warn(request.log, "admin.forbidden", {});
    return reply.status(403).send({ message: "Admin access required", code: "ADMIN_REQUIRED" });
  }

  const [targetUser, targetHouse] = await Promise.all([
    prisma.user.findUnique({
      where: { id: parsed.data.targetUserId },
      select: { id: true, organizationId: true },
    }),
    prisma.house.findUnique({
      where: { id: parsed.data.targetHouseId },
      select: { id: true, organizationId: true, name: true },
    }),
  ]);

  if (!targetUser || targetUser.organizationId !== actor.organizationId) {
    return reply.status(404).send({ message: "Target user not found", code: "TARGET_USER_NOT_FOUND" });
  }

  if (!targetHouse || targetHouse.organizationId !== actor.organizationId) {
    return reply.status(404).send({ message: "Target house not found", code: "TARGET_HOUSE_NOT_FOUND" });
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUser.id },
    data: { houseId: targetHouse.id },
    select: {
      id: true,
      displayName: true,
      houseId: true,
    },
  });

  info(request.log, "admin.user.house_assigned", {
    actorUserId: actor.id,
    organizationId: actor.organizationId,
    targetUserId: updatedUser.id,
    targetHouseId: targetHouse.id,
    targetHouseName: targetHouse.name,
  });

  return updatedUser;
});

app.post("/points/adjust", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
  const parsed = adjustPointsSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);

  if (!actor) {
    warn(request.log, "points.actor_not_found", {
      targetUserId: parsed.data.targetUserId,
      delta: parsed.data.delta,
    });
    return reply.status(403).send({
      message: "Signed-in user is not mapped to an internal account",
      code: "ACTOR_NOT_MAPPED",
    });
  }

  if (!actor.houseId) {
    warn(request.log, "points.actor_house_unassigned", {
      actorUserId: actor.id,
      actorAuth0Sub: actor.auth0Sub,
      targetUserId: parsed.data.targetUserId,
      delta: parsed.data.delta,
    });
    return reply.status(403).send({
      message: "Signed-in user must be assigned to a house before awarding points",
      code: "ACTOR_HOUSE_UNASSIGNED",
    });
  }

  // Resolve the target user and derive their house
  const targetUser = await prisma.user.findUnique({
    where: { id: parsed.data.targetUserId },
    select: { id: true, organizationId: true, houseId: true, displayName: true },
  });

  if (!targetUser || targetUser.organizationId !== actor.organizationId) {
    warn(request.log, "points.cross_organization_target", {
      actorUserId: actor.id,
      actorAuth0Sub: actor.auth0Sub,
      actorOrganizationId: actor.organizationId,
      targetUserId: parsed.data.targetUserId,
    });
    return reply.status(403).send({
      message: "Target user is outside your organization",
      code: "CROSS_ORGANIZATION_TARGET",
    });
  }

  if (!targetUser.houseId) {
    warn(request.log, "points.target_user_unassigned", {
      actorUserId: actor.id,
      targetUserId: targetUser.id,
    });
    return reply.status(422).send({
      message: "Target user is not assigned to a house",
      code: "TARGET_USER_UNASSIGNED",
    });
  }

  let activeSeason;
  try {
    activeSeason = await resolveSeasonScope(actor);
  } catch (err) {
    if (err instanceof SeasonScopeError) {
      error(request.log, "points.active_season_missing", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
      });
      return reply.status(err.statusCode).send({
        message: "An active season is required before points can be awarded",
        code: err.code,
      });
    }
    throw err;
  }

  const transaction = await prisma.pointTransaction.create({
    data: {
      organizationId: actor.organizationId,
      seasonId: activeSeason.id,
      actorUserId: actor.id,
      targetUserId: targetUser.id,
      targetHouseId: targetUser.houseId,
      delta: parsed.data.delta,
      reason: parsed.data.reason,
      trait: parsed.data.trait,
    },
  });

  info(request.log, "points.adjusted", {
    transactionId: transaction.id,
    actorUserId: actor.id,
    actorAuth0Sub: actor.auth0Sub,
    organizationId: actor.organizationId,
    targetUserId: targetUser.id,
    targetHouseId: targetUser.houseId,
    delta: transaction.delta,
  });

  return reply.status(201).send(transaction);
});

// POST /users/profile - update the authenticated user's display name
app.post("/users/profile", async (request, reply) => {
  const parsed = updateProfileSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "users.profile.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);

  if (!actor) {
    warn(request.log, "points.actor_not_found", {});
    return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
  }

  const updated = await prisma.user.update({
    where: { id: actor.id },
    data: { displayName: parsed.data.displayName },
    select: { id: true, displayName: true },
  });

  info(request.log, "users.profile.updated", {
    actorUserId: actor.id,
    displayName: updated.displayName,
  });

  return updated;
});

// POST /users/scores - per-member point totals (sum of delta grouped by targetUserId)
app.post("/users/scores", async (request, reply) => {
  const parsed = seasonScopedRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
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

  const grouped = await prisma.pointTransaction.groupBy({
    by: ["targetUserId"],
    where: {
      organizationId: actor.organizationId,
      seasonId: season.id,
      targetUserId: { not: null },
    },
    _sum: { delta: true },
    orderBy: { _sum: { delta: "desc" } },
  });

  return grouped.map((row) => ({
    memberId: row.targetUserId as string,
    points: row._sum.delta ?? 0,
  }));
});

// POST /members - returns org members for the award dialog (any authenticated member)
app.post("/members", async (request, reply) => {
  const parsed = actorScopeSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);

  if (!actor) {
    warn(request.log, "points.actor_not_found", {});
    return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
  }

  const members = await prisma.user.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      role: true,
      houseId: true,
      house: { select: { name: true, color: true } },
    },
  });

  return members.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    role: m.role,
    houseId: m.houseId,
    houseName: m.house?.name ?? null,
    houseColor: m.house?.color ?? null,
  }));
});

// POST /transactions/recent - enriched activity feed
app.post("/transactions/recent", async (request, reply) => {
  const parsed = actorScopeSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);

  if (!actor) {
    warn(request.log, "points.actor_not_found", {});
    return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
  }

  const transactions = await prisma.pointTransaction.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      delta: true,
      reason: true,
      trait: true,
      createdAt: true,
      actor: { select: { displayName: true } },
      targetUser: { select: { displayName: true } },
      targetHouse: { select: { name: true, color: true } },
    },
  });

  return transactions.map(mapActivityItem);
});

// ── Org management ───────────────────────────────────────────────────────────

// POST /orgs/create — first-time org setup; caller becomes OWNER
app.post("/orgs/create", async (request, reply) => {
  const parsed = createOrgSchema.safeParse(request.body);
  if (!parsed.success) {
    warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const {
    email,
    displayName,
    orgName,
    orgSlug,
    firstHouseName,
    firstHouseColor,
  } = parsed.data;
  const auth0Sub = request.auth.subject;

  // Reject if slug is already taken
  const slugTaken = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } });
  if (slugTaken) {
    warn(request.log, "orgs.create.slug_taken", { orgSlug });
    return reply.status(409).send({ code: "SLUG_TAKEN", message: `The slug "${orgSlug}" is already in use. Choose a different one.` });
  }

  // Reject if this Auth0 user is already in an org
  const existingUser = await prisma.user.findUnique({
    where: { auth0Sub },
    select: { id: true, organizationId: true },
  });
  if (existingUser?.organizationId) {
    warn(request.log, "orgs.create.already_in_org", { auth0Sub, existingOrgId: existingUser.organizationId });
    return reply.status(409).send({ code: "ALREADY_IN_ORG", message: "You are already a member of an organisation." });
  }

  const { org, house, user } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: orgName, slug: orgSlug },
      select: { id: true, slug: true, name: true },
    });

    const house = await tx.house.create({
      data: {
        organizationId: org.id,
        name: firstHouseName,
        color: firstHouseColor,
      },
      select: { id: true, name: true, color: true },
    });

    const userSelect = {
      id: true,
      auth0Sub: true,
      email: true,
      displayName: true,
      role: true,
      organizationId: true,
      organization: { select: { slug: true } },
      houseId: true,
      house: { select: { name: true, color: true } },
    } as const;

    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            organizationId: org.id,
            houseId: house.id,
            role: "OWNER",
            displayName,
            email: email ?? null,
          },
          select: userSelect,
        })
      : await tx.user.create({
          data: {
            auth0Sub,
            email: email ?? null,
            displayName,
            organizationId: org.id,
            houseId: house.id,
            role: "OWNER",
          },
          select: userSelect,
        });

    return { org, house, user };
  });

  info(request.log, "orgs.created", {
    orgId: org.id,
    orgSlug: org.slug,
    houseId: house.id,
    ownerId: user.id,
  });
  return reply.status(201).send({ ...mapAppUser(user), created: true });
});

// POST /orgs/invite — admin/owner generates a single-use invite link
app.post("/orgs/invite", async (request, reply) => {
  const parsed = createInviteSchema.safeParse(request.body);
  if (!parsed.success) {
    warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);
  if (!actor || !isAdmin(actor.role)) {
    warn(request.log, "admin.forbidden", {});
    return reply.status(403).send({ code: "ADMIN_REQUIRED", message: "Admin access required" });
  }

  const rawToken = generateInviteToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000);

  const invite = await prisma.orgInvite.create({
    data: {
      organizationId: actor.organizationId,
      tokenHash,
      createdById: actor.id,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });

  info(request.log, "orgs.invite.created", { inviteId: invite.id, actorId: actor.id, orgId: actor.organizationId, expiresAt });

  return reply.status(201).send({
    id: invite.id,
    // Return the raw token ONCE — it is never stored in the DB
    token: rawToken,
    expiresAt: invite.expiresAt.toISOString(),
    usedAt: null,
  });
});

// POST /orgs/join — consume an invite token and add the user to the org
app.post("/orgs/join", async (request, reply) => {
  const parsed = joinOrgSchema.safeParse(request.body);
  if (!parsed.success) {
    warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const { email, displayName, inviteToken } = parsed.data;
  const auth0Sub = request.auth.subject;
  const tokenHash = hashToken(inviteToken);

  const userSelect = {
    id: true, auth0Sub: true, email: true, displayName: true, role: true,
    organizationId: true, organization: { select: { slug: true } },
    houseId: true, house: { select: { name: true, color: true } },
  } as const;
  const claimedAt = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invite = await tx.orgInvite.findUnique({
        where: { tokenHash },
        select: { id: true, organizationId: true, expiresAt: true, usedAt: true },
      });

      if (!invite) {
        throw new InviteJoinError(
          404,
          "INVITE_NOT_FOUND",
          "Invite link is invalid or has already been used.",
        );
      }

      if (invite.usedAt) {
        throw new InviteJoinError(
          409,
          "INVITE_USED",
          "This invite link has already been used.",
          invite.id,
        );
      }

      if (invite.expiresAt <= claimedAt) {
        throw new InviteJoinError(
          410,
          "INVITE_EXPIRED",
          "This invite link has expired. Ask an admin to generate a new one.",
          invite.id,
        );
      }

      const existingUser = await tx.user.findUnique({
        where: { auth0Sub },
        select: { id: true, organizationId: true },
      });

      if (
        existingUser?.organizationId &&
        existingUser.organizationId !== invite.organizationId
      ) {
        throw new InviteJoinError(
          409,
          "ALREADY_IN_ORG",
          "You are already a member of an organisation.",
          invite.id,
        );
      }

      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              organizationId: invite.organizationId,
              displayName,
              email: email ?? undefined,
            },
            select: userSelect,
          })
        : await tx.user.create({
            data: {
              auth0Sub,
              email: email ?? null,
              displayName,
              organizationId: invite.organizationId,
            },
            select: userSelect,
          });

      const claim = await tx.orgInvite.updateMany({
        where: {
          id: invite.id,
          usedAt: null,
          expiresAt: { gt: claimedAt },
        },
        data: {
          usedAt: claimedAt,
          usedById: user.id,
        },
      });

      if (claim.count !== 1) {
        throw new InviteJoinError(
          409,
          "INVITE_USED",
          "This invite link has already been used.",
          invite.id,
        );
      }

      return {
        user,
        created: !existingUser,
        inviteId: invite.id,
        organizationId: invite.organizationId,
      };
    });

    info(request.log, "orgs.join.success", {
      userId: result.user.id,
      orgId: result.organizationId,
      inviteId: result.inviteId,
    });
    return reply.status(200).send({
      ...mapAppUser(result.user),
      created: result.created,
    });
  } catch (err) {
    if (!(err instanceof InviteJoinError)) {
      throw err;
    }

    const event =
      err.code === "INVITE_NOT_FOUND"
        ? "orgs.join.invalid_token"
        : err.code === "INVITE_EXPIRED"
          ? "orgs.join.token_expired"
          : err.code === "INVITE_USED"
            ? "orgs.join.token_already_used"
            : "orgs.join.already_in_org";

    warn(request.log, event, {
      auth0Sub,
      inviteId: err.inviteId,
    });
    return reply.status(err.statusCode).send({
      code: err.code,
      message: err.message,
    });
  }
});

  return app;
}


