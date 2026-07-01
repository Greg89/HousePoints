import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import {
  actorScopeSchema,
  markNotificationsReadSchema,
  notificationListRequestSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import type { ActorRecord } from "../actor.js";
import { info } from "../logging.js";
import { parseBody, requireActor } from "../route-helpers.js";

const NOTIFICATION_SELECT = {
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
} as const;

function mapNotification(notification: Prisma.NotificationGetPayload<{ select: typeof NOTIFICATION_SELECT }>) {
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

export async function listNotifications(
  actor: ActorRecord,
  params: { limit: number; unreadOnly: boolean; cursor?: string },
) {
  const where = {
    organizationId: actor.organizationId,
    recipientUserId: actor.id,
    archivedAt: null,
    ...(params.unreadOnly ? { readAt: null } : {}),
  };
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: NOTIFICATION_SELECT,
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
  return {
    items: notifications.slice(0, params.limit),
    unreadCount,
    hasNextPage: notifications.length > params.limit,
  };
}

export async function markNotificationsRead(
  actor: ActorRecord,
  notificationIds: string[],
) {
  const result = await prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
      organizationId: actor.organizationId,
      recipientUserId: actor.id,
      archivedAt: null,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return { updatedCount: result.count };
}

export async function markAllNotificationsRead(actor: ActorRecord) {
  const result = await prisma.notification.updateMany({
    where: {
      organizationId: actor.organizationId,
      recipientUserId: actor.id,
      archivedAt: null,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return { updatedCount: result.count };
}

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/notifications/list", async (request, reply) => {
    const parsed = await parseBody(notificationListRequestSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { items, unreadCount, hasNextPage } = await listNotifications(actor, parsed);

    info(request.log, "notifications.loaded", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      unreadOnly: parsed.unreadOnly,
      cursor: parsed.cursor ?? null,
      notifications: items.length,
      unreadCount,
      hasNextPage,
    });

    return {
      items: items.map(mapNotification),
      unreadCount,
      nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
    };
  });

  app.post("/notifications/mark-read", async (request, reply) => {
    const parsed = await parseBody(markNotificationsReadSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { updatedCount } = await markNotificationsRead(actor, parsed.notificationIds);

    info(request.log, "notifications.marked_read", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      requestedCount: parsed.notificationIds.length,
      updatedCount,
    });

    return { updatedCount };
  });

  app.post("/notifications/mark-all-read", async (request, reply) => {
    const parsed = await parseBody(actorScopeSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { updatedCount } = await markAllNotificationsRead(actor);

    info(request.log, "notifications.marked_all_read", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      updatedCount,
    });

    return { updatedCount };
  });
}
