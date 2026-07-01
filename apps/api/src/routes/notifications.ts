import type { FastifyInstance } from "fastify";
import {
  actorScopeSchema,
  markNotificationsReadSchema,
  notificationListRequestSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { getActorBySub } from "../actor.js";
import { info, warn } from "../logging.js";

type NotificationRecord = {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  actionLabel: string | null;
  actionHref: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

function mapNotification(notification: NotificationRecord) {
  return {
    id: notification.id,
    type: notification.type,
    severity: notification.severity,
    title: notification.title,
    body: notification.body,
    actionLabel: notification.actionLabel,
    actionHref: notification.actionHref,
    entityType: notification.entityType,
    entityId: notification.entityId,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/notifications/list", async (request, reply) => {
    const parsed = notificationListRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      warn(request.log, "request.validation_failed", {
        issues: parsed.error.issues,
      });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const actor = await getActorBySub(request.auth.subject);

    if (!actor) {
      warn(request.log, "notifications.actor_not_found", {});
      return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
    }

    const limit = parsed.data.limit;
    const where = {
      organizationId: actor.organizationId,
      recipientUserId: actor.id,
      archivedAt: null,
      ...(parsed.data.unreadOnly ? { readAt: null } : {}),
    };
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: limit + 1,
        ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          type: true,
          severity: true,
          title: true,
          body: true,
          actionLabel: true,
          actionHref: true,
          entityType: true,
          entityId: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: {
          organizationId: actor.organizationId,
          recipientUserId: actor.id,
          archivedAt: null,
          readAt: null,
        },
      }),
    ]);
    const pageNotifications = notifications.slice(0, limit);

    info(request.log, "notifications.loaded", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      unreadOnly: parsed.data.unreadOnly,
      cursor: parsed.data.cursor ?? null,
      notifications: pageNotifications.length,
      unreadCount,
      hasNextPage: notifications.length > limit,
    });

    return {
      items: pageNotifications.map(mapNotification),
      unreadCount,
      nextCursor: notifications.length > limit ? pageNotifications.at(-1)?.id ?? null : null,
    };
  });

  app.post("/notifications/mark-read", async (request, reply) => {
    const parsed = markNotificationsReadSchema.safeParse(request.body);

    if (!parsed.success) {
      warn(request.log, "request.validation_failed", {
        issues: parsed.error.issues,
      });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const actor = await getActorBySub(request.auth.subject);

    if (!actor) {
      warn(request.log, "notifications.actor_not_found", {});
      return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
    }

    const result = await prisma.notification.updateMany({
      where: {
        id: { in: parsed.data.notificationIds },
        organizationId: actor.organizationId,
        recipientUserId: actor.id,
        archivedAt: null,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    info(request.log, "notifications.marked_read", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      requestedCount: parsed.data.notificationIds.length,
      updatedCount: result.count,
    });

    return { updatedCount: result.count };
  });

  app.post("/notifications/mark-all-read", async (request, reply) => {
    const parsed = actorScopeSchema.safeParse(request.body);

    if (!parsed.success) {
      warn(request.log, "request.validation_failed", {
        issues: parsed.error.issues,
      });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const actor = await getActorBySub(request.auth.subject);

    if (!actor) {
      warn(request.log, "notifications.actor_not_found", {});
      return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
    }

    const result = await prisma.notification.updateMany({
      where: {
        organizationId: actor.organizationId,
        recipientUserId: actor.id,
        archivedAt: null,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    info(request.log, "notifications.marked_all_read", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      updatedCount: result.count,
    });

    return { updatedCount: result.count };
  });
}
