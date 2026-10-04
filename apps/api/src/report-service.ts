import type { Prisma } from "@prisma/client";
import type { ReportPageRequest, ReportPageResponse, ReportScope } from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { decodeReportCursor, encodeReportCursor, ReportReadError } from "./report-cursor.js";

const REPORT_ITEM_SELECT = {
  id: true, type: true, delta: true, reason: true, trait: true, createdAt: true,
  category: { select: { id: true, name: true, archivedAt: true } },
  targetHouse: { select: { id: true, name: true, color: true } },
  targetUser: { select: { id: true, displayName: true } },
  actor: { select: { id: true, displayName: true } },
} as const;

type ReportRow = Prisma.PointTransactionGetPayload<{ select: typeof REPORT_ITEM_SELECT }>;

function scopedWhere(organizationId: string, scope: ReportScope): Prisma.PointTransactionWhereInput {
  return {
    organizationId,
    seasonId: scope.seasonId,
    deletedAt: null,
    ...(scope.houseId ? { targetHouseId: scope.houseId } : {}),
    ...(scope.memberId !== undefined ? { targetUserId: scope.memberId } : {}),
    ...(scope.categoryId ? { categoryId: scope.categoryId } : {}),
    ...(scope.giverId ? { actorUserId: scope.giverId } : {}),
    ...(scope.type ? { type: scope.type } : {}),
  };
}

function mapReportRow(row: ReportRow): ReportPageResponse["items"][number] {
  return {
    id: row.id,
    type: row.type,
    delta: row.delta,
    reason: row.reason,
    trait: row.trait,
    category: row.category ? {
      id: row.category.id,
      name: row.category.name,
      archivedAt: row.category.archivedAt?.toISOString() ?? null,
    } : null,
    house: row.targetHouse,
    member: {
      id: row.targetUser?.id ?? null,
      displayName: row.targetUser?.displayName ?? "Unattributed",
    },
    giver: row.actor,
    createdAt: row.createdAt.toISOString(),
  };
}

async function validateReportScope(
  tx: Prisma.TransactionClient,
  organizationId: string,
  scope: ReportScope,
) {
  const season = await tx.season.findFirst({
    where: { id: scope.seasonId, organizationId }, select: { id: true },
  });
  if (!season) throw new ReportReadError(404, "REPORT_SCOPE_NOT_FOUND", "Report season not found.");

  if (scope.houseId) {
    const house = await tx.house.findFirst({
      where: { id: scope.houseId, organizationId }, select: { id: true },
    });
    if (!house) throw new ReportReadError(404, "REPORT_SCOPE_NOT_FOUND", "Report house not found.");
  }
  if (scope.categoryId) {
    const category = await tx.recognitionCategory.findFirst({
      where: { id: scope.categoryId, organizationId }, select: { id: true },
    });
    if (!category) throw new ReportReadError(404, "REPORT_SCOPE_NOT_FOUND", "Report category not found.");
  }
  for (const [userId, field] of [
    [scope.memberId, "targetUserId"],
    [scope.giverId, "actorUserId"],
  ] as const) {
    if (!userId) continue;
    const membership = await tx.organizationMembership.findFirst({
      where: { organizationId, userId }, select: { id: true },
    });
    if (membership) continue;
    const historical = await tx.pointTransaction.findFirst({
      where: { organizationId, [field]: userId }, select: { id: true },
    });
    if (!historical) throw new ReportReadError(404, "REPORT_SCOPE_NOT_FOUND", "Report person not found.");
  }
}

export async function readReportPage(params: {
  organizationId: string;
  membershipId: string;
  actorUserId: string;
  request: ReportPageRequest;
  cursorSecret: string;
}): Promise<ReportPageResponse> {
  const { organizationId, membershipId, actorUserId, request, cursorSecret } = params;
  const { limit, cursor, ...scope } = request;
  const cursorPosition = cursor
    ? decodeReportCursor(cursor, organizationId, scope, cursorSecret)
    : null;

  return prisma.$transaction(async (tx) => {
    const membership = await tx.organizationMembership.findFirst({
      where: {
        id: membershipId, userId: actorUserId, organizationId,
        isActive: true, archivedAt: null,
        organization: { archivedAt: null, suspendedAt: null },
      },
      select: { id: true },
    });
    if (!membership) throw new ReportReadError(403, "REPORT_ACCESS_REVOKED", "Report access is no longer available.");

    const organization = await tx.organization.findUnique({
      where: { id: organizationId }, select: { reportingRevision: true },
    });
    if (!organization) throw new ReportReadError(404, "REPORT_SCOPE_NOT_FOUND", "Organization not found.");
    const revision = organization.reportingRevision.toString();
    if (cursorPosition && cursorPosition.revision !== revision) {
      throw new ReportReadError(409, "REPORT_REFRESH_REQUIRED", "Report data changed. Refresh from the first page.");
    }

    await validateReportScope(tx, organizationId, scope);
    const where = scopedWhere(organizationId, scope);
    const totals = await tx.pointTransaction.groupBy({
      by: ["type"], where, _sum: { delta: true }, _count: { _all: true },
    });
    const award = totals.find((row) => row.type === "AWARD");
    const deduction = totals.find((row) => row.type === "DEDUCTION");
    const awardedPoints = Math.max(0, award?._sum.delta ?? 0);
    const deductedPoints = Math.abs(Math.min(0, deduction?._sum.delta ?? 0));

    let deductionsOutsideCategory: { points: number; count: number } | null = null;
    if (scope.categoryId) {
      const withoutCategoryOrType: ReportScope = {
        seasonId: scope.seasonId,
        houseId: scope.houseId,
        memberId: scope.memberId,
        giverId: scope.giverId,
      };
      const deductionTotals = await tx.pointTransaction.groupBy({
        by: ["type"],
        where: { ...scopedWhere(organizationId, withoutCategoryOrType), type: "DEDUCTION" },
        _sum: { delta: true }, _count: { _all: true },
      });
      const row = deductionTotals[0];
      deductionsOutsideCategory = {
        points: Math.abs(Math.min(0, row?._sum.delta ?? 0)),
        count: row?._count._all ?? 0,
      };
    }

    const createdAt = cursorPosition ? new Date(cursorPosition.createdAt) : null;
    if (createdAt && Number.isNaN(createdAt.getTime())) {
      throw new ReportReadError(400, "INVALID_REPORT_CURSOR", "Report cursor is invalid.");
    }
    const rows = await tx.pointTransaction.findMany({
      where: {
        ...where,
        ...(createdAt ? { OR: [
          { createdAt: { lt: createdAt } },
          { createdAt, id: { lt: cursorPosition!.id } },
        ] } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: REPORT_ITEM_SELECT,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      scope,
      revision,
      summary: {
        netPoints: awardedPoints - deductedPoints,
        awardedPoints,
        deductedPoints,
        transactionCount: (award?._count._all ?? 0) + (deduction?._count._all ?? 0),
        awardCount: award?._count._all ?? 0,
        deductionCount: deduction?._count._all ?? 0,
        deductionsOutsideCategory,
      },
      items: page.map(mapReportRow),
      nextCursor: rows.length > limit && last
        ? encodeReportCursor({
            organizationId, scope, revision,
            createdAt: last.createdAt.toISOString(), id: last.id,
          }, cursorSecret)
        : null,
    };
  }, { isolationLevel: "RepeatableRead", maxWait: 5_000, timeout: 10_000 });
}
