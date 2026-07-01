import type { FastifyInstance } from "fastify";
import {
  adjustPointsSchema,
  activityFeedRequestSchema,
  deletePointTransactionSchema,
  deductPointsSchema,
  seasonScopedRequestSchema,
  TRAIT_LABELS,
  type PointTransactionType,
  type Trait,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { info, warn } from "../logging.js";
import { parseBody, requireActor, requireAdminActor, resolveSeasonOrReject } from "../route-helpers.js";

export function mapActivityItem(tx: {
  id: string;
  actor: { displayName: string };
  targetUser: { displayName: string } | null;
  targetHouse: { name: string; color: string };
  type: PointTransactionType;
  delta: number;
  reason: string;
  trait: Trait | null;
  createdAt: Date;
  season?: { id: string; name: string; isActive: boolean } | null;
}) {
  return {
    id: tx.id,
    actorName: tx.actor.displayName,
    targetUserName: tx.targetUser?.displayName ?? "Unknown",
    targetHouseName: tx.targetHouse.name,
    targetHouseColor: tx.targetHouse.color,
    type: tx.type,
    delta: tx.delta,
    reason: tx.reason,
    trait: tx.trait ?? null,
    createdAt: tx.createdAt.toISOString(),
    season: tx.season
      ? {
          id: tx.season.id,
          name: tx.season.name,
          isActive: tx.season.isActive,
        }
      : null,
  };
}

export function mapDeletedPoint(tx: {
  id: string;
  actor: { displayName: string };
  targetUser: { displayName: string } | null;
  targetHouse: { name: string; color: string };
  type: PointTransactionType;
  delta: number;
  reason: string;
  trait: Trait | null;
  createdAt: Date;
  deletedAt: Date | null;
  deletedBy: { displayName: string } | null;
  deletionReason: string | null;
  season?: { id: string; name: string; isActive: boolean } | null;
}) {
  return {
    ...mapActivityItem(tx),
    deletedAt: (tx.deletedAt ?? tx.createdAt).toISOString(),
    deletedByName: tx.deletedBy?.displayName ?? null,
    deletionReason: tx.deletionReason,
  };
}

type PointRouteOptions = {
  pointAdjustmentsEnabled: boolean;
};

export async function registerPointRoutes(
  app: FastifyInstance,
  options: PointRouteOptions,
): Promise<void> {
  app.post("/points/adjust", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = await parseBody(adjustPointsSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    if (!actor.houseId) {
      warn(request.log, "points.actor_house_unassigned", {
        actorUserId: actor.id,
        actorAuth0Sub: actor.auth0Sub,
        targetUserId: parsed.targetUserId,
        delta: parsed.delta,
      });
      return reply.status(403).send({
        message: "Signed-in user must be assigned to a house before awarding points",
        code: "ACTOR_HOUSE_UNASSIGNED",
      });
    }

    // Resolve the target user and derive their house
    const targetUser = await prisma.user.findUnique({
      where: { id: parsed.targetUserId },
      select: { id: true, organizationId: true, houseId: true, displayName: true },
    });

    if (!targetUser || targetUser.organizationId !== actor.organizationId) {
      warn(request.log, "points.cross_organization_target", {
        actorUserId: actor.id,
        actorAuth0Sub: actor.auth0Sub,
        actorOrganizationId: actor.organizationId,
        targetUserId: parsed.targetUserId,
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

    const targetHouseId = targetUser.houseId;
    const activeSeason = await resolveSeasonOrReject(actor, undefined, request, reply);
    if (!activeSeason) return;

    const transaction = await prisma.$transaction(async (tx) => {
      const award = await tx.pointTransaction.create({
        data: {
          organizationId: actor.organizationId,
          seasonId: activeSeason.id,
          actorUserId: actor.id,
          targetUserId: targetUser.id,
          targetHouseId,
          type: "AWARD",
          delta: parsed.delta,
          reason: parsed.reason,
          trait: parsed.trait,
        },
      });

      if (targetUser.id !== actor.id) {
        await tx.notification.createMany({
          data: [{
            organizationId: actor.organizationId,
            recipientUserId: targetUser.id,
            type: "POINT_AWARD_RECEIVED",
            severity: "INFO",
            title: "Points awarded",
            body: `${actor.displayName} awarded you ${parsed.delta} points for ${TRAIT_LABELS[parsed.trait]}.`,
            actionLabel: "View activity",
            actionHref: "/?tab=activity",
            entityType: "PointTransaction",
            entityId: award.id,
            dedupeKey: `point-award-received:${actor.organizationId}:${award.id}`,
          }],
          skipDuplicates: true,
        });
      }

      return award;
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

  app.post("/points/deduct", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    if (!options.pointAdjustmentsEnabled) {
      warn(request.log, "points.deduct.disabled", {});
      return reply.status(404).send({
        message: "Point adjustments are not enabled",
        code: "POINT_ADJUSTMENTS_DISABLED",
      });
    }

    const parsed = await parseBody(deductPointsSchema, request, reply);
    if (!parsed) return;

    const actor = await requireAdminActor(request, reply);
    if (!actor) return;

    if (!actor.houseId) {
      warn(request.log, "points.deduct.actor_house_required", {
        actorUserId: actor.id,
        actorAuth0Sub: actor.auth0Sub,
        targetUserId: parsed.targetUserId,
      });
      return reply.status(403).send({
        message: "Signed-in user must be assigned to a house before deducting points",
        code: "ACTOR_HOUSE_REQUIRED",
      });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: parsed.targetUserId },
      select: { id: true, organizationId: true, houseId: true, displayName: true },
    });

    if (!targetUser) {
      warn(request.log, "points.deduct.target_user_not_found", {
        actorUserId: actor.id,
        actorOrganizationId: actor.organizationId,
        targetUserId: parsed.targetUserId,
      });
      return reply.status(404).send({
        message: "Target user was not found",
        code: "TARGET_USER_NOT_FOUND",
      });
    }

    if (targetUser.organizationId !== actor.organizationId) {
      warn(request.log, "points.deduct.cross_organization_target", {
        actorUserId: actor.id,
        actorAuth0Sub: actor.auth0Sub,
        actorOrganizationId: actor.organizationId,
        targetUserId: targetUser.id,
      });
      return reply.status(403).send({
        message: "Target user is outside your organization",
        code: "CROSS_ORGANIZATION_TARGET",
      });
    }

    if (!targetUser.houseId) {
      warn(request.log, "points.deduct.target_user_unassigned", {
        actorUserId: actor.id,
        targetUserId: targetUser.id,
      });
      return reply.status(422).send({
        message: "Target user is not assigned to a house",
        code: "TARGET_USER_UNASSIGNED",
      });
    }

    if (targetUser.houseId === actor.houseId) {
      warn(request.log, "points.deduct.same_house_target", {
        actorUserId: actor.id,
        actorHouseId: actor.houseId,
        targetUserId: targetUser.id,
      });
      return reply.status(409).send({
        message: "Points can only be deducted from members in another house",
        code: "SAME_HOUSE_TARGET",
      });
    }

    const targetHouseId = targetUser.houseId;
    const activeSeason = await resolveSeasonOrReject(actor, undefined, request, reply);
    if (!activeSeason) return;

    const cooldownWindowStartsAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentHouseDeduction, recentTargetDeduction] = await Promise.all([
      prisma.pointTransaction.findFirst({
        where: {
          organizationId: actor.organizationId,
          seasonId: activeSeason.id,
          type: "DEDUCTION",
          createdAt: { gte: cooldownWindowStartsAt },
          actor: {
            houseId: actor.houseId,
          },
        },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.pointTransaction.findFirst({
        where: {
          organizationId: actor.organizationId,
          seasonId: activeSeason.id,
          type: "DEDUCTION",
          targetUserId: targetUser.id,
          createdAt: { gte: cooldownWindowStartsAt },
        },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (recentHouseDeduction) {
      warn(request.log, "points.deduct.cooldown_active", {
        actorUserId: actor.id,
        actorHouseId: actor.houseId,
        organizationId: actor.organizationId,
        seasonId: activeSeason.id,
        previousTransactionId: recentHouseDeduction.id,
        previousCreatedAt: recentHouseDeduction.createdAt.toISOString(),
      });
      return reply.status(409).send({
        message: "This house has already deducted points in the last 24 hours",
        code: "DEDUCTION_COOLDOWN_ACTIVE",
      });
    }

    if (recentTargetDeduction) {
      warn(request.log, "points.deduct.target_limit_active", {
        actorUserId: actor.id,
        targetUserId: targetUser.id,
        organizationId: actor.organizationId,
        seasonId: activeSeason.id,
        previousTransactionId: recentTargetDeduction.id,
        previousCreatedAt: recentTargetDeduction.createdAt.toISOString(),
      });
      return reply.status(409).send({
        message: "This member has already received a deduction in the last 24 hours",
        code: "TARGET_DEDUCTION_LIMIT_ACTIVE",
      });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const deduction = await tx.pointTransaction.create({
        data: {
          organizationId: actor.organizationId,
          seasonId: activeSeason.id,
          actorUserId: actor.id,
          targetUserId: targetUser.id,
          targetHouseId,
          type: "DEDUCTION",
          delta: -10,
          reason: parsed.reason,
          trait: null,
        },
        select: { id: true },
      });

      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          eventType: "POINTS_DEDUCTED",
          summary: `${actor.displayName} deducted 10 points from ${targetUser.displayName}.`,
          metadata: {
            transactionId: deduction.id,
            targetUserId: targetUser.id,
            targetUserName: targetUser.displayName,
            targetHouseId,
            seasonId: activeSeason.id,
            seasonName: activeSeason.name,
            delta: -10,
            reason: parsed.reason,
          },
        },
      });

      await tx.notification.createMany({
        data: [{
          organizationId: actor.organizationId,
          recipientUserId: targetUser.id,
          type: "POINT_DEDUCTION_RECEIVED",
          severity: "WARNING",
          title: "Points deducted",
          body: `${actor.displayName} deducted 10 points from you. Reason: ${parsed.reason}.`,
          actionLabel: "View activity",
          actionHref: "/?tab=activity",
          entityType: "PointTransaction",
          entityId: deduction.id,
          dedupeKey: `point-deduction-received:${actor.organizationId}:${deduction.id}`,
        }],
        skipDuplicates: true,
      });

      return deduction;
    });

    info(request.log, "points.deducted", {
      transactionId: transaction.id,
      actorUserId: actor.id,
      actorAuth0Sub: actor.auth0Sub,
      organizationId: actor.organizationId,
      targetUserId: targetUser.id,
      targetHouseId: targetUser.houseId,
      delta: -10,
    });

    return reply.status(201).send(transaction);
  });

  app.post("/users/scores", async (request, reply) => {
    const parsed = await parseBody(seasonScopedRequestSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const season = await resolveSeasonOrReject(actor, parsed.seasonId, request, reply);
    if (!season) return;

    const grouped = await prisma.pointTransaction.groupBy({
      by: ["targetUserId"],
      where: {
        organizationId: actor.organizationId,
        seasonId: season.id,
        deletedAt: null,
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

  app.post("/transactions/recent", async (request, reply) => {
    const parsed = await parseBody(activityFeedRequestSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const transactions = await prisma.pointTransaction.findMany({
      where: { organizationId: actor.organizationId, deletedAt: null },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: parsed.limit + 1,
      ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        type: true,
        delta: true,
        reason: true,
        trait: true,
        createdAt: true,
        actor: { select: { displayName: true } },
        targetUser: { select: { displayName: true } },
        targetHouse: { select: { name: true, color: true } },
        season: { select: { id: true, name: true, isActive: true } },
      },
    });

    const items = transactions.slice(0, parsed.limit);
    const nextCursor = transactions.length > parsed.limit ? items.at(-1)?.id ?? null : null;

    return {
      items: items.map(mapActivityItem),
      nextCursor,
    };
  });

  app.post("/points/delete", async (request, reply) => {
    const parsed = await parseBody(deletePointTransactionSchema, request, reply);
    if (!parsed) return;

    const actor = await requireAdminActor(request, reply);
    if (!actor) return;

    const existing = await prisma.pointTransaction.findUnique({
      where: { id: parsed.transactionId },
      select: {
        id: true,
        organizationId: true,
        deletedAt: true,
      },
    });

    if (!existing || existing.organizationId !== actor.organizationId) {
      warn(request.log, "points.delete.not_found", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        transactionId: parsed.transactionId,
      });
      return reply.status(404).send({ message: "Point transaction not found", code: "POINT_TRANSACTION_NOT_FOUND" });
    }

    if (existing.deletedAt) {
      warn(request.log, "points.delete.already_deleted", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        transactionId: existing.id,
      });
      return reply.status(409).send({ message: "Point transaction is already deleted", code: "POINT_TRANSACTION_ALREADY_DELETED" });
    }

    const deletionReason = parsed.reason?.trim() || null;
    const deletedPoint = await prisma.$transaction(async (tx) => {
      const point = await tx.pointTransaction.update({
        where: { id: existing.id },
        data: {
          deletedAt: new Date(),
          deletedByUserId: actor.id,
          deletionReason,
        },
        select: {
          id: true,
          type: true,
          delta: true,
          reason: true,
          trait: true,
          targetUserId: true,
          targetHouseId: true,
          createdAt: true,
          deletedAt: true,
          deletionReason: true,
          actor: { select: { displayName: true } },
          targetUser: { select: { displayName: true } },
          targetHouse: { select: { name: true, color: true } },
          deletedBy: { select: { displayName: true } },
          season: { select: { id: true, name: true, isActive: true } },
        },
      });

      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          eventType: "POINT_DELETED",
          summary: `${actor.displayName} deleted ${point.delta} points from ${point.targetUser?.displayName ?? "Unknown member"}.`,
          metadata: {
            transactionId: point.id,
            targetUserId: point.targetUserId,
            targetUserName: point.targetUser?.displayName ?? null,
            targetHouseId: point.targetHouseId,
            targetHouseName: point.targetHouse.name,
            delta: point.delta,
            trait: point.trait,
            awardReason: point.reason,
            deletionReason,
          },
        },
      });

      return point;
    });

    info(request.log, "points.deleted", {
      transactionId: deletedPoint.id,
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      delta: deletedPoint.delta,
    });

    return mapDeletedPoint(deletedPoint);
  });
}
