import type { FastifyInstance } from "fastify";
import {
  dashboardSummaryRequestSchema,
  rankScores,
  scoreWinners,
  seasonScopedRequestSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { info } from "../logging.js";
import {
  mapSeason,
} from "../season-scope.js";
import { parseBody, requireActor, resolveSeasonOrReject } from "../route-helpers.js";
import { mapActivityItem } from "./points.js";

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

export async function loadLeaderboard(organizationId: string, seasonId: string) {
  const [houses, houseTotals, memberships] = await Promise.all([
    prisma.house.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
      },
    }),
    prisma.pointTransaction.groupBy({
      by: ["targetHouseId"],
      where: { organizationId, seasonId, deletedAt: null },
      _sum: { delta: true },
      _count: { _all: true },
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId, isActive: true, archivedAt: null, houseId: { not: null } },
      select: { houseId: true },
    }),
  ]);

  const totalsByHouseId = new Map(
    houseTotals.map((row) => [
      row.targetHouseId,
      { score: row._sum.delta ?? 0, transactions: row._count._all },
    ]),
  );
  const memberCountsByHouseId = new Map<string, number>();
  for (const membership of memberships) {
    if (!membership.houseId) continue;
    memberCountsByHouseId.set(
      membership.houseId,
      (memberCountsByHouseId.get(membership.houseId) ?? 0) + 1,
    );
  }

  return rankScores(houses.map((house) => {
    const totals = totalsByHouseId.get(house.id);
    return {
      id: house.id,
      name: house.name,
      color: house.color,
      description: house.description,
      score: totals?.score ?? 0,
      transactions: totals?.transactions ?? 0,
      memberCount: memberCountsByHouseId.get(house.id) ?? 0,
      points: totals?.score ?? 0,
    };
  })).map((house) => ({
    id: house.id, name: house.name, color: house.color,
    description: house.description, score: house.score,
    transactions: house.transactions, memberCount: house.memberCount, rank: house.rank,
  }));
}

export async function loadDashboardSummaryData(
  organizationId: string,
  seasonId: string,
  velocityStartsAt: Date,
) {
  const [
    houses,
    monthlyMemberTotals,
    monthlyTraitTotals,
    recentTransactions,
    velocityTransactions,
    houseTotals,
    transactionTypeTotals,
    memberships,
    categoryTotals,
    categories,
  ] = await Promise.all([
    prisma.house.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.pointTransaction.groupBy({
      by: ["targetUserId", "targetHouseId"],
      where: { organizationId, seasonId, deletedAt: null },
      _sum: { delta: true },
    }),
    prisma.pointTransaction.groupBy({
      by: ["targetHouseId", "trait"],
      where: { organizationId, seasonId, deletedAt: null, trait: { not: null } },
      _count: { trait: true },
    }),
    prisma.pointTransaction.findMany({
      where: { organizationId, seasonId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, type: true, delta: true, reason: true, trait: true, createdAt: true,
        category: { select: { id: true, name: true, legacyTrait: true, archivedAt: true } },
        actor: { select: { displayName: true } },
        targetUser: { select: { displayName: true } },
        targetHouse: { select: { name: true, color: true } },
        season: { select: { id: true, name: true, isActive: true } },
      },
    }),
    prisma.pointTransaction.findMany({
      where: { organizationId, seasonId, deletedAt: null, createdAt: { gte: velocityStartsAt } },
      select: { targetHouseId: true, delta: true, createdAt: true },
    }),
    prisma.pointTransaction.groupBy({
      by: ["targetHouseId"],
      where: { organizationId, seasonId, deletedAt: null },
      _sum: { delta: true },
      _count: { _all: true },
    }),
    prisma.pointTransaction.groupBy({
      by: ["type"],
      where: { organizationId, seasonId, deletedAt: null },
      _sum: { delta: true },
      _count: { _all: true },
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId, isActive: true, archivedAt: null },
      orderBy: { user: { displayName: "asc" } },
      select: {
        role: true,
        houseId: true,
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    }),
    prisma.pointTransaction.groupBy({
      by: ["targetHouseId", "categoryId"],
      where: {
        organizationId,
        seasonId,
        deletedAt: null,
        type: "AWARD",
        categoryId: { not: null },
      },
      _count: { categoryId: true },
    }),
    prisma.recognitionCategory.findMany({
      where: { organizationId },
      select: { id: true, name: true, legacyTrait: true, archivedAt: true },
    }),
  ]);
  const members = memberships.map((membership) => ({
    id: membership.user.id,
    displayName: membership.user.displayName,
    role: membership.role,
    houseId: membership.houseId,
  }));
  const recipientIds = [...new Set(monthlyMemberTotals
    .map((row) => row.targetUserId)
    .filter((id): id is string => id !== null))];
  const recipients = recipientIds.length
    ? await prisma.user.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, displayName: true },
      })
    : [];
  return { houses, monthlyMemberTotals, monthlyTraitTotals, recentTransactions, velocityTransactions, houseTotals, transactionTypeTotals, members, recipients, categoryTotals, categories };
}

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.post("/houses/leaderboard", async (request, reply) => {
    const parsed = await parseBody(seasonScopedRequestSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const season = await resolveSeasonOrReject(actor, parsed.seasonId, request, reply);
    if (!season) return;

    const leaderboard = await loadLeaderboard(actor.organizationId, season.id);

    info(request.log, "leaderboard.fetched", {
      organizationId: actor.organizationId,
      seasonId: season.id,
      houses: leaderboard.length,
    });

    return leaderboard;
  });

  app.post("/dashboard/summary", async (request, reply) => {
    const parsed = await parseBody(dashboardSummaryRequestSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const season = await resolveSeasonOrReject(actor, parsed.seasonId, request, reply);
    if (!season) return;

    const now = new Date();
    const velocityDates = lastUtcDateKeys(14, now);
    const velocityStartsAt = new Date(`${velocityDates[0]}T00:00:00.000Z`);

    const {
      houses,
      monthlyMemberTotals,
      monthlyTraitTotals,
      recentTransactions,
      velocityTransactions,
      houseTotals,
      transactionTypeTotals,
      members,
      recipients,
      categoryTotals,
      categories,
    } = await loadDashboardSummaryData(actor.organizationId, season.id, velocityStartsAt);

    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const hasCustomCategoryAwards = categoryTotals.some((total) => {
      const category = total.categoryId ? categoryById.get(total.categoryId) : null;
      return category?.legacyTrait === null;
    });

    if (
      parsed.categoryApiVersion !== "categories-v1" &&
      hasCustomCategoryAwards
    ) {
      return reply.status(426).send({
        code: "RECOGNITION_CATEGORY_CLIENT_UPGRADE_REQUIRED",
        message: "Update HousePoints to view custom recognition activity.",
      });
    }

    const houseById = new Map(houses.map((house) => [house.id, house]));
    const memberById = new Map(members.map((member) => [member.id, member]));
    const recipientNameById = new Map(recipients.map((user) => [user.id, user.displayName]));

    function toStandout(row: (typeof monthlyMemberTotals)[number] | undefined) {
      if (!row?.targetUserId) return null;
      const member = memberById.get(row.targetUserId);
      const house = houseById.get(row.targetHouseId);
      if (!house) return null;

      return {
        memberId: row.targetUserId,
        memberName: recipientNameById.get(row.targetUserId) ?? member?.displayName ?? "Former member",
        houseId: house.id,
        houseName: house.name,
        houseColor: house.color,
        points: row._sum.delta ?? 0,
      };
    }

    const monthlyMemberTotalsByMember = new Map<string, (typeof monthlyMemberTotals)[number]>();
    for (const row of [...monthlyMemberTotals]
      .filter((entry) => entry.targetUserId)
      .sort((a, b) => (b._sum.delta ?? 0) - (a._sum.delta ?? 0) || a.targetHouseId.localeCompare(b.targetHouseId))) {
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

    const monthlyStandoutRows = Array.from(monthlyMemberTotalsByMember.values());
    const rankedPersonal = rankScores(monthlyStandoutRows.map((row) => ({
      id: row.targetUserId as string,
      name: recipientNameById.get(row.targetUserId as string) ?? memberById.get(row.targetUserId as string)?.displayName ?? "Former member",
      points: row._sum.delta ?? 0,
      row,
    })));
    const monthlyStandoutRow = rankedPersonal[0]?.row;

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
    const categoryLeaders = houses.map((house) => {
      const topCategory = categoryTotals
        .filter((row) => row.targetHouseId === house.id && row.categoryId)
        .sort((a, b) => b._count.categoryId - a._count.categoryId)[0];
      const category = topCategory?.categoryId ? categoryById.get(topCategory.categoryId) : null;
      return {
        houseId: house.id,
        houseName: house.name,
        houseColor: house.color,
        category: category
          ? {
              id: category.id,
              name: category.name,
              legacyTrait: category.legacyTrait,
              archivedAt: category.archivedAt?.toISOString() ?? null,
            }
          : null,
        count: topCategory?._count.categoryId ?? 0,
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
      members: rankScores(monthlyMemberTotals
        .filter((row) => row.targetHouseId === house.id)
        .map((row) => {
          const member = row.targetUserId ? memberById.get(row.targetUserId) : null;
          return {
            id: row.targetUserId ?? "unattributed",
            name: row.targetUserId
              ? recipientNameById.get(row.targetUserId) ?? member?.displayName ?? "Former member"
              : "Unattributed",
            memberId: row.targetUserId,
            displayName: row.targetUserId
              ? recipientNameById.get(row.targetUserId) ?? member?.displayName ?? "Former member"
              : "Unattributed",
            role: member?.role ?? null,
            points: row._sum.delta ?? 0,
            isCurrentMember: Boolean(member),
            currentHouseId: member?.houseId ?? null,
          };
        }))
        .map((entry) => ({
          memberId: entry.memberId, displayName: entry.displayName, role: entry.role,
          points: entry.points, rank: entry.rank, isCurrentMember: entry.isCurrentMember,
          currentHouseId: entry.currentHouseId,
        })),
    }));
    const transactionTotalsByType = new Map(transactionTypeTotals.map((row) => [row.type, row]));
    const awardTotals = transactionTotalsByType.get("AWARD");
    const deductionTotals = transactionTotalsByType.get("DEDUCTION");
    const totalTransactions = transactionTypeTotals.reduce((total, row) => total + row._count._all, 0);
    const housePoints = new Map(houseTotals.map((row) => [row.targetHouseId, row._sum.delta ?? 0]));
    const winningHouses = scoreWinners(houses.map((house) => ({
      id: house.id, name: house.name, points: housePoints.get(house.id) ?? 0,
      houseId: house.id, houseName: house.name, houseColor: house.color,
    })), totalTransactions).map((house) => ({
      houseId: house.houseId, houseName: house.houseName,
      houseColor: house.houseColor, points: house.points,
    }));
    const winningHouse = winningHouses[0] ?? null;

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
          .filter((row) =>
            row.targetHouseId === house.id &&
            row.targetUserId &&
            houseById.has(row.targetHouseId)
          )
          .sort((a, b) => (b._sum.delta ?? 0) - (a._sum.delta ?? 0))[0],
      ),
    }));
    const seasonWinnerSummary = season.isActive || !season.endsAt
      ? null
      : {
          seasonId: season.id,
          seasonName: season.name,
          startsAt: season.startsAt.toISOString(),
          endsAt: season.endsAt.toISOString(),
          winningHouse,
          winningHouses,
          topContributor: seasonStandout,
          topContributors: totalTransactions === 0 ? [] : rankedPersonal
            .filter((entry) => entry.rank === 1)
            .map((entry) => toStandout(entry.row))
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
          totalTransactions,
          awardCount: awardTotals?._count._all ?? 0,
          deductionCount: deductionTotals?._count._all ?? 0,
          awardedPoints: Math.max(0, awardTotals?._sum.delta ?? 0),
          deductedPoints: Math.abs(Math.min(0, deductionTotals?._sum.delta ?? 0)),
        };

    return {
      generatedAt: now.toISOString(),
      selectedSeason: mapSeason(season),
      seasonWinnerSummary,
      seasonStartsAt: season.startsAt.toISOString(),
      seasonStandout,
      seasonStandoutsByHouse,
      monthStartsAt: season.startsAt.toISOString(),
      monthlyStandout: seasonStandout,
      monthlyStandoutsByHouse: seasonStandoutsByHouse,
      traitLeaders,
      categoryLeaders,
      recentActivity: recentTransactions.map((transaction) => mapActivityItem(transaction)),
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
}
