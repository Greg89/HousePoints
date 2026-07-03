import type { FastifyInstance } from "fastify";
import {
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
  const [houses, houseTotals] = await Promise.all([
    prisma.house.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        _count: { select: { users: true } },
      },
    }),
    prisma.pointTransaction.groupBy({
      by: ["targetHouseId"],
      where: { organizationId, seasonId, deletedAt: null },
      _sum: { delta: true },
      _count: { _all: true },
    }),
  ]);

  const totalsByHouseId = new Map(
    houseTotals.map((row) => [
      row.targetHouseId,
      { score: row._sum.delta ?? 0, transactions: row._count._all },
    ]),
  );

  return houses
    .map((house) => {
      const totals = totalsByHouseId.get(house.id);
      return {
        id: house.id,
        name: house.name,
        color: house.color,
        description: house.description,
        score: totals?.score ?? 0,
        transactions: totals?.transactions ?? 0,
        memberCount: house._count.users,
      };
    })
    .sort((a, b) => b.score - a.score);
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
    memberTotals,
    houseTotals,
    transactionTypeTotals,
    members,
  ] = await Promise.all([
    prisma.house.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.pointTransaction.groupBy({
      by: ["targetUserId", "targetHouseId"],
      where: { organizationId, seasonId, deletedAt: null, targetUserId: { not: null } },
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
      by: ["targetUserId"],
      where: { organizationId, seasonId, deletedAt: null, targetUserId: { not: null } },
      _sum: { delta: true },
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
    prisma.user.findMany({
      where: { organizationId },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, role: true, houseId: true },
    }),
  ]);
  return { houses, monthlyMemberTotals, monthlyTraitTotals, recentTransactions, velocityTransactions, memberTotals, houseTotals, transactionTypeTotals, members };
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
    const parsed = await parseBody(seasonScopedRequestSchema, request, reply);
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
      memberTotals,
      houseTotals,
      transactionTypeTotals,
      members,
    } = await loadDashboardSummaryData(actor.organizationId, season.id, velocityStartsAt);

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
    const transactionTotalsByType = new Map(transactionTypeTotals.map((row) => [row.type, row]));
    const awardTotals = transactionTotalsByType.get("AWARD");
    const deductionTotals = transactionTotalsByType.get("DEDUCTION");
    const totalTransactions = transactionTypeTotals.reduce((total, row) => total + row._count._all, 0);
    const housePoints = new Map(houseTotals.map((row) => [row.targetHouseId, row._sum.delta ?? 0]));
    const winningHouse = totalTransactions === 0
      ? null
      : houses
          .map((house) => ({
            houseId: house.id,
            houseName: house.name,
            houseColor: house.color,
            points: housePoints.get(house.id) ?? 0,
          }))
          .sort((a, b) => b.points - a.points || a.houseName.localeCompare(b.houseName))[0] ?? null;

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
    const seasonWinnerSummary = season.isActive || !season.endsAt
      ? null
      : {
          seasonId: season.id,
          seasonName: season.name,
          startsAt: season.startsAt.toISOString(),
          endsAt: season.endsAt.toISOString(),
          winningHouse,
          topContributor: seasonStandout,
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
}
