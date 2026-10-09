import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import {
  actorScopeSchema,
  createSeasonSchema,
  discardSeasonPlanSchema,
  kickoffSeasonSchema,
  isValidIanaTimeZone,
  renameSeasonSchema,
  rankScores,
  saveSeasonPlanSchema,
  seasonCompareRequestSchema,
  updateSeasonPlannedEndSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { activeScoringSeason, scoringWriteTime, withScoringWrite } from "../scoring-write.js";
import type { ActorRecord } from "../actor.js";
import { SeasonScopeError, mapSeason } from "../season-scope.js";
import { parseBody, requireActor, requireAdminActor, requireOwnerActor } from "../route-helpers.js";
import { info, warn } from "../logging.js";
import {
  buildSeasonStartedNotificationData,
  dispatchPushForNotifications,
  type NotificationRow,
} from "../notifications.js";
import type { PushDispatcher } from "../push-dispatcher.js";

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
  plannedEndsAt?: Date | null;
  timezone?: string | null;
  isActive: boolean;
};

class SeasonPlanConflictError extends Error {
  constructor() {
    super("The season plan changed. Refresh it before saving.");
    this.name = "SeasonPlanConflictError";
  }
}

class SeasonPlanNameConflictError extends Error {
  constructor() {
    super("A season with that name already exists.");
    this.name = "SeasonPlanNameConflictError";
  }
}

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
    userId: string | null;
    displayName: string;
    points: number;
  } | null;
  topContributors: Array<{ userId: string | null; displayName: string; points: number }>;
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
  return new Map(rankScores(houses.map((house) => ({
    id: house.id, name: house.name, points: pointsByHouseId.get(house.id) ?? 0,
  }))).map((house) => [house.id, house.rank]));
}

export async function loadSeasonsForOrg(organizationId: string) {
  return prisma.season.findMany({
    where: { organizationId },
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      plannedEndsAt: true,
      timezone: true,
      isActive: true,
    },
  });
}

export async function loadSeasonCompareData(
  organizationId: string,
  seasonIds: string[],
) {
  return prisma.season.findMany({
    where: { id: { in: seasonIds }, organizationId },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      plannedEndsAt: true,
      timezone: true,
      isActive: true,
    },
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
      where: { organizationId, seasonId: { in: seasonIds }, deletedAt: null },
      _sum: { delta: true },
    }),
  ]);
  return { houses, houseTotals, contributorTotals };
}

export async function loadContributorNames(
  userIds: string[],
) {
  if (!userIds.length) return [];
  // IDs originate from organization-scoped transactions, including former members.
  return prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true },
  });
}

interface PreparedSeasonKickoff {
  expectedActiveSeasonId: string;
  expectedPlanVersion: number;
  idempotencyKey: string;
}

class SeasonKickoffReadinessError extends Error {
  constructor() {
    super("Add at least one active recognition category before starting a season.");
    this.name = "SeasonKickoffReadinessError";
  }
}

class SeasonKickoffIdempotencyConflictError extends Error {
  constructor() {
    super("This kickoff retry key was already used for a different season plan.");
    this.name = "SeasonKickoffIdempotencyConflictError";
  }
}

async function lockAndVerifyOwner(tx: Prisma.TransactionClient, actor: ActorRecord) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "OrganizationMembership"
    WHERE id = ${actor.membershipId}
      AND "organizationId" = ${actor.organizationId}
      AND "userId" = ${actor.id}
      AND role = 'OWNER'
      AND "isActive" = true
      AND "archivedAt" IS NULL
    FOR UPDATE
  `;
  if (!rows.length) {
    throw new SeasonScopeError(403, "OWNER_REQUIRED", "Organization owner access is required.");
  }
}

export async function startSeasonTransaction(
  actor: ActorRecord,
  seasonName: string | null,
  preparedKickoff?: PreparedSeasonKickoff,
) {
  return withScoringWrite(actor.organizationId, async (tx) => {
    await lockAndVerifyOwner(tx, actor);

    if (preparedKickoff) {
      const completedTransition = await tx.seasonTransition.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: actor.organizationId,
            idempotencyKey: preparedKickoff.idempotencyKey,
          },
        },
        include: { previousSeason: true, activeSeason: true },
      });
      if (completedTransition) {
        if (
          completedTransition.previousSeasonId !== preparedKickoff.expectedActiveSeasonId ||
          completedTransition.planVersion !== preparedKickoff.expectedPlanVersion
        ) {
          throw new SeasonKickoffIdempotencyConflictError();
        }
        return {
          previousSeason: completedTransition.previousSeason,
          activeSeason: completedTransition.activeSeason,
          notificationRows: [],
          replayed: true,
        };
      }
    }

    const currentSeason = await activeScoringSeason(tx, actor.organizationId);
    let plan: Awaited<ReturnType<typeof tx.seasonPlan.findUnique>> = null;
    if (preparedKickoff) {
      if (currentSeason.id !== preparedKickoff.expectedActiveSeasonId) {
        throw new SeasonScopeError(
          409,
          "ACTIVE_SEASON_CHANGED",
          "The active season changed. Refresh before kicking off the prepared season.",
        );
      }
      plan = await tx.seasonPlan.findUnique({
        where: { organizationId: actor.organizationId },
      });
      if (!plan || plan.version !== preparedKickoff.expectedPlanVersion) {
        throw new SeasonPlanConflictError();
      }
      if (await tx.recognitionCategory.count({
        where: { organizationId: actor.organizationId, archivedAt: null },
      }) === 0) {
        throw new SeasonKickoffReadinessError();
      }
      const existingSeason = await tx.season.findFirst({
        where: { organizationId: actor.organizationId, name: plan.name },
        select: { id: true },
      });
      if (existingSeason) throw new SeasonPlanNameConflictError();
    }

    const nextSeasonName = plan?.name ?? seasonName;
    if (!nextSeasonName) throw new SeasonPlanConflictError();
    const now = await scoringWriteTime(tx);
    const previousSeason = await tx.season.update({
      where: { id: currentSeason.id },
      data: { isActive: false, endsAt: now },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        plannedEndsAt: true,
        timezone: true,
        isActive: true,
      },
    });
    const activeSeason = await tx.season.create({
      data: {
        organizationId: actor.organizationId,
        name: nextSeasonName,
        startsAt: now,
        isActive: true,
        createdById: actor.id,
        ...(plan ? { plannedEndsAt: plan.plannedEndsAt, timezone: plan.timezone } : {}),
      },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        plannedEndsAt: true,
        timezone: true,
        isActive: true,
      },
    });

    if (preparedKickoff && plan) {
      await tx.seasonTransition.create({
        data: {
          organizationId: actor.organizationId,
          idempotencyKey: preparedKickoff.idempotencyKey,
          planVersion: plan.version,
          previousSeasonId: previousSeason.id,
          activeSeasonId: activeSeason.id,
        },
      });
    }

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
          ...(plan ? { planId: plan.id, planVersion: plan.version } : {}),
        },
      },
    });

    const notificationRecipients = await tx.organizationMembership.findMany({
      where: {
        organizationId: actor.organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: { user: { select: { id: true } } },
    });

    const notificationRows: NotificationRow[] = notificationRecipients.map((recipient) =>
      buildSeasonStartedNotificationData({
        organizationId: actor.organizationId,
        recipientId: recipient.user.id,
        actorDisplayName: actor.displayName,
        seasonName: activeSeason.name,
        seasonId: activeSeason.id,
        kickoffMessage: plan?.kickoffMessage,
      }));
    if (notificationRows.length > 0) {
      await tx.notification.createMany({
        data: notificationRows,
        skipDuplicates: true,
      });
    }

    if (plan) {
      await tx.seasonPlan.delete({ where: { id: plan.id } });
    }

    return { previousSeason, activeSeason, notificationRows, replayed: false };
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
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      plannedEndsAt: true,
      timezone: true,
      isActive: true,
    },
  });
}

function mapSeasonPlan(plan: {
  id: string;
  name: string;
  kickoffMessage: string | null;
  plannedStartsAt: Date | null;
  plannedEndsAt: Date | null;
  timezone: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: plan.id,
    name: plan.name,
    kickoffMessage: plan.kickoffMessage,
    plannedStartsAt: plan.plannedStartsAt?.toISOString() ?? null,
    plannedEndsAt: plan.plannedEndsAt?.toISOString() ?? null,
    timezone: plan.timezone,
    version: plan.version,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function hasValidTimezone(timezone: string): boolean {
  return isValidIanaTimeZone(timezone);
}

function seasonPlanAuditData(
  organizationId: string,
  actor: ActorRecord,
  eventType: "SEASON_PLAN_CREATED" | "SEASON_PLAN_UPDATED" | "SEASON_PLAN_DISCARDED",
  summary: string,
  metadata: Prisma.InputJsonObject,
) {
  return {
    organizationId,
    actorUserId: actor.id,
    eventType,
    summary,
    metadata,
  };
}

async function saveSeasonPlan(
  actor: ActorRecord,
  input: ReturnType<typeof saveSeasonPlanSchema.parse>,
) {
  return withScoringWrite(actor.organizationId, async (tx) => {
    const existing = await tx.seasonPlan.findUnique({
      where: { organizationId: actor.organizationId },
    });
    if ((existing?.version ?? 0) !== input.expectedVersion) {
      throw new SeasonPlanConflictError();
    }

    const overlappingSeason = await tx.season.findFirst({
      where: { organizationId: actor.organizationId, name: input.name },
      select: { id: true },
    });
    if (overlappingSeason) {
      throw new SeasonPlanNameConflictError();
    }

    const planData = {
      name: input.name,
      kickoffMessage: input.kickoffMessage || null,
      plannedStartsAt: input.plannedStartsAt ? new Date(input.plannedStartsAt) : null,
      plannedEndsAt: input.plannedEndsAt ? new Date(input.plannedEndsAt) : null,
      timezone: input.timezone,
    };
    const plan = existing
      ? await tx.seasonPlan.update({
          where: { id: existing.id },
          data: { ...planData, version: { increment: 1 }, updatedById: actor.id },
        })
      : await tx.seasonPlan.create({
          data: {
            organizationId: actor.organizationId,
            ...planData,
            version: 1,
            createdById: actor.id,
            updatedById: actor.id,
          },
        });

    await tx.auditEvent.create({
      data: seasonPlanAuditData(
        actor.organizationId,
        actor,
        existing ? "SEASON_PLAN_UPDATED" : "SEASON_PLAN_CREATED",
        `${actor.displayName} ${existing ? "updated" : "created"} the next-season plan.`,
        {
          planId: plan.id,
          previousVersion: existing?.version ?? null,
          version: plan.version,
          beforeName: existing?.name ?? null,
          beforeKickoffMessage: existing?.kickoffMessage ?? null,
          beforePlannedStartsAt: existing?.plannedStartsAt?.toISOString() ?? null,
          beforePlannedEndsAt: existing?.plannedEndsAt?.toISOString() ?? null,
          beforeTimezone: existing?.timezone ?? null,
          afterName: plan.name,
          afterKickoffMessage: plan.kickoffMessage,
          afterPlannedStartsAt: plan.plannedStartsAt?.toISOString() ?? null,
          afterPlannedEndsAt: plan.plannedEndsAt?.toISOString() ?? null,
          afterTimezone: plan.timezone,
        },
      ),
    });
    return plan;
  });
}

async function discardSeasonPlan(actor: ActorRecord, expectedVersion: number) {
  return withScoringWrite(actor.organizationId, async (tx) => {
    const plan = await tx.seasonPlan.findUnique({
      where: { organizationId: actor.organizationId },
    });
    if (!plan || plan.version !== expectedVersion) throw new SeasonPlanConflictError();

    await tx.seasonPlan.delete({ where: { id: plan.id } });
    await tx.auditEvent.create({
      data: seasonPlanAuditData(
        actor.organizationId,
        actor,
        "SEASON_PLAN_DISCARDED",
        `${actor.displayName} discarded the next-season plan.`,
        {
          planId: plan.id,
          version: plan.version,
          name: plan.name,
          kickoffMessage: plan.kickoffMessage,
          plannedStartsAt: plan.plannedStartsAt?.toISOString() ?? null,
          plannedEndsAt: plan.plannedEndsAt?.toISOString() ?? null,
          timezone: plan.timezone,
        },
      ),
    });
  });
}

export async function registerSeasonRoutes(
  app: FastifyInstance,
  options: { pushDispatcher?: PushDispatcher } = {},
): Promise<void> {
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

  app.post("/seasons/plan-context", async (request, reply) => {
    const parsed = await parseBody(actorScopeSchema, request, reply);
    if (!parsed) return;
    const actor = await requireAdminActor(request, reply);
    if (!actor) return;

    const [activeSeason, plan, activeCategoryCount, houseCount, unassignedMemberCount] =
      await Promise.all([
        prisma.season.findFirst({
          where: { organizationId: actor.organizationId, isActive: true },
          select: {
            id: true,
            name: true,
            startsAt: true,
            endsAt: true,
            plannedEndsAt: true,
            timezone: true,
            isActive: true,
          },
        }),
        prisma.seasonPlan.findUnique({
          where: { organizationId: actor.organizationId },
        }),
        prisma.recognitionCategory.count({
          where: { organizationId: actor.organizationId, archivedAt: null },
        }),
        prisma.house.count({ where: { organizationId: actor.organizationId } }),
        prisma.organizationMembership.count({
          where: {
            organizationId: actor.organizationId,
            isActive: true,
            archivedAt: null,
            houseId: null,
          },
        }),
      ]);

    if (!activeSeason) {
      return reply.status(409).send({
        message: "An active season is required",
        code: "ACTIVE_SEASON_REQUIRED",
      });
    }

    return {
      activeSeason: mapSeason(activeSeason),
      plan: plan ? mapSeasonPlan(plan) : null,
      activeCategoryCount,
      houseCount,
      unassignedMemberCount,
    };
  });

  app.post("/seasons/plan", async (request, reply) => {
    const parsed = await parseBody(saveSeasonPlanSchema, request, reply);
    if (!parsed) return;
    const actor = await requireOwnerActor(request, reply);
    if (!actor) return;

    if (!hasValidTimezone(parsed.timezone)) {
      return reply.status(400).send({
        message: "Choose a valid IANA time zone.",
        code: "INVALID_TIMEZONE",
      });
    }

    try {
      const plan = await saveSeasonPlan(actor, parsed);
      return mapSeasonPlan(plan);
    } catch (err) {
      if (err instanceof SeasonPlanConflictError) {
        return reply.status(409).send({
          message: err.message,
          code: "SEASON_PLAN_VERSION_CONFLICT",
        });
      }
      if (err instanceof SeasonPlanNameConflictError) {
        return reply.status(409).send({
          message: err.message,
          code: "SEASON_NAME_TAKEN",
        });
      }
      throw err;
    }
  });

  app.post("/seasons/plan/discard", async (request, reply) => {
    const parsed = await parseBody(discardSeasonPlanSchema, request, reply);
    if (!parsed) return;
    const actor = await requireOwnerActor(request, reply);
    if (!actor) return;

    try {
      await discardSeasonPlan(actor, parsed.expectedVersion);
      return { discarded: true as const };
    } catch (err) {
      if (err instanceof SeasonPlanConflictError) {
        return reply.status(409).send({
          message: err.message,
          code: "SEASON_PLAN_VERSION_CONFLICT",
        });
      }
      throw err;
    }
  });

  app.post("/seasons/planned-end", async (request, reply) => {
    const parsed = await parseBody(updateSeasonPlannedEndSchema, request, reply);
    if (!parsed) return;
    const actor = await requireOwnerActor(request, reply);
    if (!actor) return;

    if (!hasValidTimezone(parsed.timezone)) {
      return reply.status(400).send({
        message: "Choose a valid IANA time zone.",
        code: "INVALID_TIMEZONE",
      });
    }

    try {
      const updatedSeason = await withScoringWrite(actor.organizationId, async (tx) => {
        const activeSeason = await activeScoringSeason(tx, actor.organizationId);
        if (activeSeason.id !== parsed.seasonId) {
          throw new SeasonScopeError(
            409,
            "ACTIVE_SEASON_CHANGED",
            "The active season changed. Refresh before updating its planned end.",
          );
        }
        const season = await tx.season.update({
          where: { id: activeSeason.id },
          data: {
            plannedEndsAt: parsed.plannedEndsAt ? new Date(parsed.plannedEndsAt) : null,
            timezone: parsed.timezone,
          },
          select: {
            id: true,
            name: true,
            startsAt: true,
            endsAt: true,
            plannedEndsAt: true,
            timezone: true,
            isActive: true,
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: actor.organizationId,
            actorUserId: actor.id,
            eventType: "SEASON_PLANNED_END_UPDATED",
            summary: `${actor.displayName} updated the planned end for ${season.name}.`,
            metadata: {
              seasonId: season.id,
              beforePlannedEndsAt: activeSeason.plannedEndsAt?.toISOString() ?? null,
              beforeTimezone: activeSeason.timezone ?? null,
              afterPlannedEndsAt: season.plannedEndsAt?.toISOString() ?? null,
              afterTimezone: season.timezone,
            },
          },
        });
        return season;
      });
      return mapSeason(updatedSeason);
    } catch (err) {
      if (err instanceof SeasonScopeError) {
        return reply.status(err.statusCode).send({ message: err.message, code: err.code });
      }
      throw err;
    }
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
    const users = await loadContributorNames(userIds);
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

    const contributorsBySeasonHouse = new Map<string, HouseMetric["topContributors"]>();

    for (const row of contributorTotals) {
      const points = row._sum.delta ?? 0;
      const displayName = row.targetUserId
        ? userNamesById.get(row.targetUserId) ?? "Former member"
        : "Unattributed";

      const key = seasonHouseKey(row.seasonId, row.targetHouseId);
      const contributors = contributorsBySeasonHouse.get(key) ?? [];
      contributors.push({ userId: row.targetUserId, displayName, points });
      contributorsBySeasonHouse.set(key, contributors);
    }

    const fromRanks = buildRanks(houses, pointsBySeason.get(fromSeason.id) ?? new Map());
    const toRanks = buildRanks(houses, pointsBySeason.get(toSeason.id) ?? new Map());
    const fromDays = seasonActiveDays(fromSeason);
    const toDays = seasonActiveDays(toSeason);

    function metricFor(season: SeasonRecord, house: HouseRecord, ranks: Map<string, number>, days: number): HouseMetric {
      const key = seasonHouseKey(season.id, house.id);
      const totals = totalsBySeasonHouse.get(key) ?? { points: 0, transactions: 0 };
      const rankedContributors = rankScores((contributorsBySeasonHouse.get(key) ?? []).map((entry) => ({
        ...entry, id: entry.userId ?? "unattributed", name: entry.displayName,
      })));
      const topContributors = rankedContributors
        .filter((entry) => entry.rank === 1)
        .map((entry) => ({
          userId: entry.userId, displayName: entry.displayName, points: entry.points,
        }));

      return {
        rank: ranks.get(house.id) ?? houses.length,
        points: totals.points,
        transactions: totals.transactions,
        averagePointsPerDay: roundMetric(totals.points / days),
        topContributor: topContributors[0] ?? null,
        topContributors,
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
      await dispatchPushForNotifications({
        client: prisma,
        dispatcher: options.pushDispatcher,
        logger: request.log,
        rows: transition.notificationRows,
      });

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
        if (err.code === "OWNER_REQUIRED") {
          warn(request.log, "seasons.start.forbidden", {
            actorUserId: actor.id,
            organizationId: actor.organizationId,
          });
        } else {
          warn(request.log, "seasons.active_missing", {
            actorUserId: actor.id,
            organizationId: actor.organizationId,
          });
        }
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

  app.post("/seasons/kickoff", async (request, reply) => {
    const parsed = await parseBody(kickoffSeasonSchema, request, reply);
    if (!parsed) return;

    const actor = await requireOwnerActor(request, reply);
    if (!actor) return;

    try {
      const transition = await startSeasonTransaction(actor, null, parsed);
      if (!transition.replayed) {
        await dispatchPushForNotifications({
          client: prisma,
          dispatcher: options.pushDispatcher,
          logger: request.log,
          rows: transition.notificationRows,
        });
      }

      info(request.log, "seasons.started", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        previousSeasonId: transition.previousSeason.id,
        activeSeasonId: transition.activeSeason.id,
        replayed: transition.replayed,
      });

      return {
        previousSeason: mapSeason(transition.previousSeason),
        activeSeason: mapSeason(transition.activeSeason),
      };
    } catch (err) {
      if (err instanceof SeasonScopeError) {
        return reply.status(err.statusCode).send({ message: err.message, code: err.code });
      }
      if (err instanceof SeasonPlanConflictError) {
        return reply.status(409).send({
          message: err.message,
          code: "SEASON_PLAN_VERSION_CONFLICT",
        });
      }
      if (err instanceof SeasonPlanNameConflictError) {
        return reply.status(409).send({
          message: err.message,
          code: "SEASON_NAME_TAKEN",
        });
      }
      if (err instanceof SeasonKickoffReadinessError) {
        return reply.status(409).send({
          message: err.message,
          code: "ACTIVE_CATEGORY_REQUIRED",
        });
      }
      if (err instanceof SeasonKickoffIdempotencyConflictError) {
        return reply.status(409).send({
          message: err.message,
          code: "IDEMPOTENCY_KEY_CONFLICT",
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
