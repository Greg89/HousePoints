import { TRAIT_LABELS, type MemberPerformance } from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { ReportReadError } from "./report-cursor.js";
import { REPORT_ITEM_SELECT, mapReportRow, readReportTotals, scopedWhere, validateReportScope, validateReportAccess } from "./report-service.js";

export async function readMemberPerformance(params: {
  organizationId: string;
  actorUserId: string;
  membershipId: string;
  memberId: string;
  season: MemberPerformance["selectedSeason"];
  now?: Date;
}): Promise<MemberPerformance> {
  const { organizationId, actorUserId, membershipId, memberId, season } = params;
  // Historical seasons use the last 14 days of the season rather than today's dates.
  const end = new Date(Math.min((params.now ?? new Date()).getTime(),
    season.endsAt ? new Date(season.endsAt).getTime() - 1 : Infinity));
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(lastDay);
    date.setUTCDate(lastDay.getUTCDate() - 13 + index);
    return { date: date.toISOString().slice(0, 10), points: 0 };
  });

  return prisma.$transaction(async (tx) => {
    await validateReportAccess(tx, { organizationId, actorUserId, membershipId });
    const scope = { memberId, seasonId: season.id };
    await validateReportScope(tx, organizationId, scope);
    const member = await tx.user.findUnique({ where: { id: memberId }, select: { id: true, displayName: true } });
    if (!member) throw new ReportReadError(404, "REPORT_SCOPE_NOT_FOUND", "Report person not found.");
    const where = scopedWhere(organizationId, scope);
    const [summary, recognitionTotals, categories, recent, velocity] = await Promise.all([
      readReportTotals(tx, where),
      tx.pointTransaction.groupBy({
        by: ["categoryId", "trait"], where: { ...where, type: "AWARD" },
        _sum: { delta: true }, _count: { _all: true },
      }),
      tx.recognitionCategory.findMany({ where: { organizationId }, select: { id: true, name: true } }),
      tx.pointTransaction.findMany({
        where, select: REPORT_ITEM_SELECT, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 8,
      }),
      tx.pointTransaction.groupBy({
        by: ["createdAt"], where: { ...where, createdAt: { gte: new Date(days[0].date), lte: end } },
        _sum: { delta: true },
      }),
    ]);
    const categoryById = new Map(categories.map((category) => [category.id, category.name]));
    const recognitionByKey = new Map<string, MemberPerformance["recognition"][number]>();
    for (const entry of recognitionTotals) {
      const key = entry.categoryId ? `category:${entry.categoryId}` : `trait:${entry.trait ?? "uncategorized"}`;
      const existing = recognitionByKey.get(key);
      recognitionByKey.set(key, {
        key,
        label: (entry.categoryId ? categoryById.get(entry.categoryId) : null)
          ?? (entry.trait ? TRAIT_LABELS[entry.trait] : "Uncategorized"),
        points: (existing?.points ?? 0) + (entry._sum.delta ?? 0),
        count: (existing?.count ?? 0) + entry._count._all,
      });
    }
    const recognition = [...recognitionByKey.values()].sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));
    for (const entry of velocity) {
      const day = days.find((item) => item.date === entry.createdAt.toISOString().slice(0, 10));
      if (day) day.points += entry._sum.delta ?? 0;
    }
    return { member, selectedSeason: season, summary, recognition, days, recentActivity: recent.map(mapReportRow) };
  }, { isolationLevel: "RepeatableRead", maxWait: 5_000, timeout: 10_000 });
}
