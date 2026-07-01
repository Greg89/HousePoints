import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import {
  type AdminAuditAction,
  adminAuditRequestSchema,
  actorScopeSchema,
  assignUserHouseSchema,
  createHouseSchema,
  promoteUserSchema,
  seasonScopedRequestSchema,
  updateOrgSlugSchema,
  updateOrgSettingsSchema,
} from "@housepoints/contracts";
import { isOrganizationSlugReserved, prisma } from "@housepoints/db";
import { info, warn } from "../logging.js";
import { parseBody, requireAdminActor, requireOwnerActor, resolveSeasonOrReject } from "../route-helpers.js";
import { mapDeletedPoint } from "./points.js";

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.post("/admin/context", async (request, reply) => {
    const parsed = await parseBody(actorScopeSchema, request, reply);
    if (!parsed) return;

    const actor = await requireAdminActor(request, reply);
    if (!actor) return;

    const [
      users,
      houses,
      recentDeletedPoints,
      recentInvites,
      inviteGeneratedCount,
      inviteUsedCount,
      activeSeason,
      activeSeasonDeductionTotals,
      recentStartedSeasons,
      auditEvents,
    ] = await Promise.all([
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
      prisma.pointTransaction.findMany({
        where: {
          organizationId: actor.organizationId,
          deletedAt: { not: null },
        },
        orderBy: [
          { deletedAt: "desc" },
          { id: "desc" },
        ],
        take: 10,
        select: {
          id: true,
          type: true,
          delta: true,
          reason: true,
          trait: true,
          createdAt: true,
          deletedAt: true,
          deletionReason: true,
          actor: { select: { displayName: true } },
          targetUser: { select: { displayName: true } },
          targetHouse: { select: { name: true, color: true } },
          deletedBy: { select: { displayName: true } },
          season: { select: { id: true, name: true, isActive: true } },
        },
      }),
      prisma.orgInvite.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: 10,
        select: {
          id: true,
          createdAt: true,
          usedAt: true,
          expiresAt: true,
          createdBy: { select: { displayName: true } },
          usedBy: { select: { displayName: true } },
        },
      }),
      prisma.orgInvite.count({
        where: { organizationId: actor.organizationId },
      }),
      prisma.orgInvite.count({
        where: {
          organizationId: actor.organizationId,
          usedAt: { not: null },
        },
      }),
      prisma.season.findFirst({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.pointTransaction.groupBy({
        by: ["targetHouseId"],
        where: {
          organizationId: actor.organizationId,
          type: "DEDUCTION",
          deletedAt: null,
          season: {
            isActive: true,
          },
        },
        _count: { _all: true },
        _sum: { delta: true },
      }),
      prisma.season.findMany({
        where: {
          organizationId: actor.organizationId,
          createdById: { not: null },
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: 10,
        select: {
          id: true,
          name: true,
          createdAt: true,
          createdBy: { select: { displayName: true } },
        },
      }),
      prisma.auditEvent.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: 11,
        select: {
          id: true,
          eventType: true,
          summary: true,
          metadata: true,
          createdAt: true,
          actor: { select: { displayName: true } },
        },
      }),
    ]);
    const recentAuditEvents = auditEvents.slice(0, 10);
    const adminAuditNextCursor = auditEvents.length > 10
      ? recentAuditEvents.at(-1)?.id ?? null
      : null;
    const recentAdminActions = buildRecentAdminActions(
      recentDeletedPoints,
      recentInvites,
      recentStartedSeasons,
      recentAuditEvents,
    );

    info(request.log, "admin.context.loaded", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      users: users.length,
      houses: houses.length,
      recentDeletedPoints: recentDeletedPoints.length,
      inviteGeneratedCount,
      inviteUsedCount,
      recentAdminActions: recentAdminActions.length,
      recentAuditEvents: recentAuditEvents.length,
    });

    const pointAdjustmentStats = buildPointAdjustmentStats(
      houses,
      activeSeason,
      activeSeasonDeductionTotals,
    );

    return {
      organizationId: actor.organizationId,
      organizationName: actor.organizationName,
      organizationSlug: actor.organizationSlug,
      users,
      houses,
      recentDeletedPoints: recentDeletedPoints.map(mapDeletedPoint),
      recentAdminActions,
      inviteStats: {
        generatedCount: inviteGeneratedCount,
        usedCount: inviteUsedCount,
      },
      pointAdjustmentStats,
      adminAuditNextCursor,
    };
  });

  app.post("/admin/org/settings", async (request, reply) => {
    const parsed = await parseBody(updateOrgSettingsSchema, request, reply);
    if (!parsed) return;

    const actor = await requireOwnerActor(request, reply);
    if (!actor) return;

    const updatedOrganization = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({
        where: { id: actor.organizationId },
        data: { name: parsed.name },
        select: { id: true, name: true, slug: true },
      });

      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          eventType: "ORG_SETTINGS_UPDATED",
          summary: `${actor.displayName} renamed the organization from ${actor.organizationName} to ${organization.name}.`,
          metadata: {
            previousName: actor.organizationName,
            newName: organization.name,
          },
        },
      });

      return organization;
    });

    info(request.log, "admin.org.settings_updated", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      previousName: actor.organizationName,
      newName: updatedOrganization.name,
    });

    return updatedOrganization;
  });

  app.post("/admin/org/slug", async (request, reply) => {
    const parsed = await parseBody(updateOrgSlugSchema, request, reply);
    if (!parsed) return;

    const actor = await requireOwnerActor(request, reply);
    if (!actor) return;

    const nextSlug = parsed.slug;
    const previousSlug = actor.organizationSlug;

    if (nextSlug === previousSlug) {
      return reply.status(409).send({
        code: "SLUG_UNCHANGED",
        message: "The organization slug is already set to that value.",
      });
    }

    if (await isOrganizationSlugReserved(prisma, nextSlug)) {
      warn(request.log, "admin.org.slug_taken", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        attemptedSlug: nextSlug,
      });
      return reply.status(409).send({
        code: "SLUG_TAKEN",
        message: "That organization slug is already reserved. Choose a different one.",
      });
    }

    try {
      const updatedOrganization = await prisma.$transaction(async (tx) => {
        await tx.organizationSlugAlias.updateMany({
          where: {
            organizationId: actor.organizationId,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
            retiredAt: new Date(),
          },
        });

        const organization = await tx.organization.update({
          where: { id: actor.organizationId },
          data: { slug: nextSlug },
          select: { id: true, name: true, slug: true },
        });

        await tx.organizationSlugAlias.create({
          data: {
            organizationId: actor.organizationId,
            slug: nextSlug,
            isPrimary: true,
          },
        });

        await tx.auditEvent.create({
          data: {
            organizationId: actor.organizationId,
            actorUserId: actor.id,
            eventType: "ORG_SETTINGS_UPDATED",
            summary: `${actor.displayName} changed the organization slug from ${previousSlug} to ${organization.slug}.`,
            metadata: {
              field: "slug",
              previousSlug,
              newSlug: organization.slug,
            },
          },
        });

        return organization;
      });

      info(request.log, "admin.org.slug_updated", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        previousSlug,
        newSlug: updatedOrganization.slug,
      });

      return updatedOrganization;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        warn(request.log, "admin.org.slug_taken", {
          actorUserId: actor.id,
          organizationId: actor.organizationId,
          attemptedSlug: nextSlug,
        });
        return reply.status(409).send({
          code: "SLUG_TAKEN",
          message: "That organization slug is already reserved. Choose a different one.",
        });
      }

      throw error;
    }
  });

  app.post("/admin/point-adjustments/stats", async (request, reply) => {
    const parsed = await parseBody(seasonScopedRequestSchema, request, reply);
    if (!parsed) return;

    const actor = await requireAdminActor(request, reply);
    if (!actor) return;

    const season = await resolveSeasonOrReject(actor, parsed.seasonId, request, reply);
    if (!season) return;

    const [houses, deductionTotals] = await Promise.all([
      prisma.house.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, color: true, description: true },
      }),
      prisma.pointTransaction.groupBy({
        by: ["targetHouseId"],
        where: {
          organizationId: actor.organizationId,
          seasonId: season.id,
          type: "DEDUCTION",
          deletedAt: null,
        },
        _count: { _all: true },
        _sum: { delta: true },
      }),
    ]);
    const stats = buildPointAdjustmentStats(houses, season, deductionTotals);

    info(request.log, "admin.point_adjustments.loaded", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      seasonId: season.id,
      deductionCount: stats.totalDeductionCount,
      deductedPoints: stats.totalDeductedPoints,
    });

    return stats;
  });

  app.post("/admin/audit", async (request, reply) => {
    const parsed = await parseBody(adminAuditRequestSchema, request, reply);
    if (!parsed) return;

    const actor = await requireAdminActor(request, reply);
    if (!actor) return;

    const limit = parsed.limit;
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(parsed.type ? { eventType: parsed.type } : {}),
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
      ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        eventType: true,
        summary: true,
        metadata: true,
        createdAt: true,
        actor: { select: { displayName: true } },
      },
    });
    const pageEvents = auditEvents.slice(0, limit);

    info(request.log, "admin.audit.loaded", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      filterType: parsed.type ?? null,
      cursor: parsed.cursor ?? null,
      actions: pageEvents.length,
      hasNextPage: auditEvents.length > limit,
    });

    return {
      items: pageEvents.map((event) => mapAuditEventToAction({
        ...event,
        eventType: event.eventType as AdminAuditAction["type"],
      })),
      nextCursor: auditEvents.length > limit ? pageEvents.at(-1)?.id ?? null : null,
    };
  });

  app.post("/admin/houses", async (request, reply) => {
    const parsed = await parseBody(createHouseSchema, request, reply);
    if (!parsed) return;

    const actor = await requireOwnerActor(request, reply);
    if (!actor) return;

    const house = await prisma.house.upsert({
      where: {
        organizationId_name: {
          organizationId: actor.organizationId,
          name: parsed.name,
        },
      },
      update: {
        color: parsed.color,
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      },
      create: {
        organizationId: actor.organizationId,
        name: parsed.name,
        color: parsed.color,
        description: parsed.description ?? null,
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
    const parsed = await parseBody(assignUserHouseSchema, request, reply);
    if (!parsed) return;

    const actor = await requireAdminActor(request, reply);
    if (!actor) return;

    const [targetUser, targetHouse] = await Promise.all([
      prisma.user.findUnique({
        where: { id: parsed.targetUserId },
        select: { id: true, displayName: true, organizationId: true },
      }),
      prisma.house.findUnique({
        where: { id: parsed.targetHouseId },
        select: { id: true, organizationId: true, name: true },
      }),
    ]);

    if (!targetUser || targetUser.organizationId !== actor.organizationId) {
      return reply.status(404).send({ message: "Target user not found", code: "TARGET_USER_NOT_FOUND" });
    }

    if (!targetHouse || targetHouse.organizationId !== actor.organizationId) {
      return reply.status(404).send({ message: "Target house not found", code: "TARGET_HOUSE_NOT_FOUND" });
    }

    const assignmentResult = await prisma.$transaction(async (tx) => {
      const assignedUser = await tx.user.update({
        where: { id: targetUser.id },
        data: { houseId: targetHouse.id },
        select: {
          id: true,
          displayName: true,
          houseId: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          eventType: "USER_HOUSE_ASSIGNED",
          summary: `${actor.displayName} assigned ${assignedUser.displayName} to ${targetHouse.name}.`,
          metadata: {
            targetUserId: assignedUser.id,
            targetUserName: assignedUser.displayName,
            targetHouseId: targetHouse.id,
            targetHouseName: targetHouse.name,
          },
        },
      });

      const resolvedAt = new Date();
      const resolvedNotifications = await tx.notification.updateMany({
        where: {
          organizationId: actor.organizationId,
          type: "MEMBER_NEEDS_HOUSE_ASSIGNMENT",
          entityType: "User",
          entityId: assignedUser.id,
          archivedAt: null,
        },
        data: {
          readAt: resolvedAt,
          archivedAt: resolvedAt,
        },
      });

      return {
        assignedUser,
        resolvedNotificationCount: resolvedNotifications.count,
      };
    });

    info(request.log, "admin.user.house_assigned", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      targetUserId: assignmentResult.assignedUser.id,
      targetHouseId: targetHouse.id,
      targetHouseName: targetHouse.name,
      resolvedNotificationCount: assignmentResult.resolvedNotificationCount,
    });

    return assignmentResult.assignedUser;
  });

  app.post("/admin/users/role", async (request, reply) => {
    const parsed = await parseBody(promoteUserSchema, request, reply);
    if (!parsed) return;

    const actor = await requireOwnerActor(request, reply);
    if (!actor) return;

    const targetUser = await prisma.user.findUnique({
      where: { id: parsed.targetUserId },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        houseId: true,
        organizationId: true,
      },
    });

    if (!targetUser || targetUser.organizationId !== actor.organizationId) {
      return reply.status(404).send({ message: "Target user not found", code: "TARGET_USER_NOT_FOUND" });
    }

    if (targetUser.role === "OWNER") {
      return reply.status(409).send({
        message: "Owner roles cannot be changed here",
        code: "OWNER_ROLE_IMMUTABLE",
      });
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const changedUser = await tx.user.update({
        where: { id: targetUser.id },
        data: { role: parsed.role },
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          houseId: true,
        },
      });

      const ownerRecipients = await tx.user.findMany({
        where: {
          organizationId: actor.organizationId,
          role: "OWNER",
          id: { not: actor.id },
        },
        select: { id: true },
      });

      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          eventType: "USER_ROLE_CHANGED",
          summary: `${actor.displayName} changed ${changedUser.displayName} from ${targetUser.role} to ${changedUser.role}.`,
          metadata: {
            targetUserId: changedUser.id,
            targetUserName: changedUser.displayName,
            previousRole: targetUser.role,
            newRole: changedUser.role,
          },
        },
      });

      const recipientIds = Array.from(
        new Set([changedUser.id, ...ownerRecipients.map((recipient) => recipient.id)]),
      );

      if (recipientIds.length > 0) {
        await tx.notification.createMany({
          data: recipientIds.map((recipientUserId) => ({
            organizationId: actor.organizationId,
            recipientUserId,
            type: "ROLE_CHANGED",
            severity: "INFO",
            title: "Role changed",
            body: `${actor.displayName} changed ${changedUser.displayName} from ${targetUser.role} to ${changedUser.role}.`,
            actionLabel: "View team",
            actionHref: "/?tab=manage&section=team",
            entityType: "User",
            entityId: changedUser.id,
          })),
          skipDuplicates: true,
        });
      }

      return changedUser;
    });

    info(request.log, "admin.user.role_changed", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      targetUserId: updatedUser.id,
      previousRole: targetUser.role,
      newRole: updatedUser.role,
    });

    return updatedUser;
  });
}

type PointAdjustmentTotalRow = {
  targetHouseId: string | null;
  _count: { _all: number };
  _sum: { delta: number | null };
};

function hasTargetHouseId(
  row: PointAdjustmentTotalRow,
): row is PointAdjustmentTotalRow & { targetHouseId: string } {
  return Boolean(row.targetHouseId);
}

function buildPointAdjustmentStats(
  houses: Array<{
    id: string;
    name: string;
    color: string;
  }>,
  season: {
    id: string;
    name: string;
  } | null,
  deductionTotals: PointAdjustmentTotalRow[],
) {
  const deductionTotalsByHouseId = new Map(
    deductionTotals
      .filter(hasTargetHouseId)
      .map((row) => [
        row.targetHouseId,
        {
          deductionCount: row._count._all,
          deductedPoints: Math.abs(row._sum.delta ?? 0),
        },
      ]),
  );

  return {
    seasonId: season?.id ?? null,
    seasonName: season?.name ?? null,
    totalDeductionCount: deductionTotals.reduce(
      (total, row) => total + row._count._all,
      0,
    ),
    totalDeductedPoints: deductionTotals.reduce(
      (total, row) => total + Math.abs(row._sum.delta ?? 0),
      0,
    ),
    byHouse: houses.map((house) => {
      const totals = deductionTotalsByHouseId.get(house.id);

      return {
        houseId: house.id,
        houseName: house.name,
        houseColor: house.color,
        deductionCount: totals?.deductionCount ?? 0,
        deductedPoints: totals?.deductedPoints ?? 0,
      };
    }),
  };
}

function buildRecentAdminActions(
  deletedPoints: Array<{
    id: string;
    delta: number;
    deletedAt: Date | null;
    deletedBy: { displayName: string } | null;
    targetUser: { displayName: string } | null;
  }>,
  invites: Array<{
    id: string;
    createdAt: Date;
    usedAt: Date | null;
    expiresAt: Date;
    createdBy: { displayName: string } | null;
    usedBy: { displayName: string } | null;
  }>,
  startedSeasons: Array<{
    id: string;
    name: string;
    createdAt: Date;
    createdBy: { displayName: string } | null;
  }>,
  auditEvents: Array<{
    id: string;
    eventType: AdminAuditAction["type"];
    summary: string;
    metadata: unknown;
    createdAt: Date;
    actor: { displayName: string } | null;
  }>,
): AdminAuditAction[] {
  const actions: AdminAuditAction[] = [];
  const auditedDeletedTransactionIds = new Set<string>();
  const auditedCreatedInviteIds = new Set<string>();
  const auditedUsedInviteIds = new Set<string>();
  const auditedStartedSeasonIds = new Set<string>();

  for (const event of auditEvents) {
    const metadata = toStringMetadata(event.metadata);

    if (event.eventType === "POINT_DELETED" && metadata.transactionId) {
      auditedDeletedTransactionIds.add(metadata.transactionId);
    }

    if (event.eventType === "INVITE_CREATED" && metadata.inviteId) {
      auditedCreatedInviteIds.add(metadata.inviteId);
    }

    if (event.eventType === "INVITE_USED" && metadata.inviteId) {
      auditedUsedInviteIds.add(metadata.inviteId);
    }

    if (event.eventType === "SEASON_STARTED" && metadata.seasonId) {
      auditedStartedSeasonIds.add(metadata.seasonId);
    }

    actions.push(mapAuditEventToAction(event, metadata));
  }

  for (const point of deletedPoints) {
    if (auditedDeletedTransactionIds.has(point.id)) {
      continue;
    }

    actions.push({
      id: `point-deleted:${point.id}`,
      type: "POINT_DELETED",
      occurredAt: (point.deletedAt ?? new Date(0)).toISOString(),
      actorName: point.deletedBy?.displayName ?? null,
      summary: `${point.deletedBy?.displayName ?? "Unknown admin"} deleted ${point.delta} points from ${point.targetUser?.displayName ?? "Unknown member"}.`,
      metadata: {
        transactionId: point.id,
        targetUserName: point.targetUser?.displayName ?? null,
      },
    });
  }

  for (const invite of invites) {
    if (!auditedCreatedInviteIds.has(invite.id)) {
      actions.push({
        id: `invite-created:${invite.id}`,
        type: "INVITE_CREATED",
        occurredAt: invite.createdAt.toISOString(),
        actorName: invite.createdBy?.displayName ?? null,
        summary: `${invite.createdBy?.displayName ?? "Unknown admin"} created an invite link.`,
        metadata: {
          inviteId: invite.id,
          expiresAt: invite.expiresAt.toISOString(),
        },
      });
    }

    if (invite.usedAt && !auditedUsedInviteIds.has(invite.id)) {
      actions.push({
        id: `invite-used:${invite.id}`,
        type: "INVITE_USED",
        occurredAt: invite.usedAt.toISOString(),
        actorName: invite.usedBy?.displayName ?? null,
        summary: `${invite.usedBy?.displayName ?? "Unknown member"} joined with an invite link.`,
        metadata: {
          inviteId: invite.id,
          usedByName: invite.usedBy?.displayName ?? null,
        },
      });
    }
  }

  for (const season of startedSeasons) {
    if (auditedStartedSeasonIds.has(season.id)) {
      continue;
    }

    actions.push({
      id: `season-started:${season.id}`,
      type: "SEASON_STARTED",
      occurredAt: season.createdAt.toISOString(),
      actorName: season.createdBy?.displayName ?? null,
      summary: `${season.createdBy?.displayName ?? "Unknown admin"} started ${season.name}.`,
      metadata: {
        seasonId: season.id,
        seasonName: season.name,
      },
    });
  }

  return actions
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id))
    .slice(0, 10);
}

function mapAuditEventToAction(
  event: {
    id: string;
    eventType: AdminAuditAction["type"];
    summary: string;
    metadata: unknown;
    createdAt: Date;
    actor: { displayName: string } | null;
  },
  preparedMetadata: Record<string, string | null> = toStringMetadata(event.metadata),
): AdminAuditAction {
  return {
    id: `audit-event:${event.id}`,
    type: event.eventType,
    occurredAt: event.createdAt.toISOString(),
    actorName: event.actor?.displayName ?? null,
    summary: event.summary,
    metadata: preparedMetadata,
  };
}

function toStringMetadata(metadata: unknown): Record<string, string | null> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      value === null || value === undefined ? null : String(value),
    ]),
  );
}
