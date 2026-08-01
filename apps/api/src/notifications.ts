import type { Prisma, PrismaClient } from "@prisma/client";
import type { FastifyBaseLogger } from "fastify";
import { POINT_REACTION_LABELS, TRAIT_LABELS, type PointReactionKey } from "@housepoints/contracts";
import { error, info } from "./logging.js";
import type { PushDispatcher, PushMessage } from "./push-dispatcher.js";

export type NotificationRow = Prisma.NotificationCreateManyInput;

const PUSH_NOTIFICATION_TYPES = new Set([
  "POINT_AWARD_RECEIVED",
  "POINT_DEDUCTION_RECEIVED",
  "POINT_REACTION_RECEIVED",
  "INVITE_ACCEPTED",
  "ROLE_CHANGED",
  "SEASON_STARTED",
  "RELEASE_ANNOUNCEMENT",
  "MEMBER_NEEDS_HOUSE_ASSIGNMENT",
]);

type DeviceLookupClient = Pick<PrismaClient, "deviceRegistration">;

export async function dispatchPushForNotifications(params: {
  rows: readonly NotificationRow[];
  dispatcher?: PushDispatcher;
  logger: FastifyBaseLogger;
  client: DeviceLookupClient;
}): Promise<void> {
  const pushableRows = params.rows.filter((row) =>
    PUSH_NOTIFICATION_TYPES.has(String(row.type)),
  );
  if (!params.dispatcher || pushableRows.length === 0) return;

  try {
    const registrations = await params.client.deviceRegistration.findMany({
      where: {
        revokedAt: null,
        OR: pushableRows.map((row) => ({
          organizationId: row.organizationId,
          userId: row.recipientUserId,
        })),
      },
      select: {
        organizationId: true,
        userId: true,
        pushToken: true,
      },
    });

    const messages: PushMessage[] = [];
    for (const row of pushableRows) {
      for (const registration of registrations) {
        if (
          registration.organizationId === row.organizationId &&
          registration.userId === row.recipientUserId
        ) {
          messages.push({
            to: registration.pushToken,
            title: row.title,
            body: row.body,
            data: {
              organizationId: row.organizationId,
              type: String(row.type),
              ...(row.entityId ? { entityId: row.entityId } : {}),
              ...(row.actionHref ? { actionHref: row.actionHref } : {}),
            },
          });
        }
      }
    }
    if (messages.length === 0) return;

    const result = await params.dispatcher.send(messages);
    info(params.logger, "notifications.push_dispatched", {
      notificationCount: pushableRows.length,
      deviceCount: messages.length,
      acceptedCount: result.acceptedCount,
    });
  } catch (err) {
    error(params.logger, "notifications.push_failed", {
      notificationCount: pushableRows.length,
    }, err);
  }
}

export function buildPointAwardNotificationData(input: {
  organizationId: string;
  recipientUserId: string;
  actorDisplayName: string;
  delta: number;
  trait: keyof typeof TRAIT_LABELS;
  transactionId: string;
}): NotificationRow {
  return {
    organizationId: input.organizationId,
    recipientUserId: input.recipientUserId,
    type: "POINT_AWARD_RECEIVED",
    severity: "INFO",
    title: "Points awarded",
    body: `${input.actorDisplayName} awarded you ${input.delta} points for ${TRAIT_LABELS[input.trait]}.`,
    actionLabel: "View activity",
    actionHref: "/?tab=activity",
    entityType: "PointTransaction",
    entityId: input.transactionId,
    dedupeKey: `point-award-received:${input.organizationId}:${input.transactionId}`,
  };
}

export function buildPointDeductionNotificationData(input: {
  organizationId: string;
  recipientUserId: string;
  actorDisplayName: string;
  reason: string;
  transactionId: string;
}): NotificationRow {
  return {
    organizationId: input.organizationId,
    recipientUserId: input.recipientUserId,
    type: "POINT_DEDUCTION_RECEIVED",
    severity: "WARNING",
    title: "Points deducted",
    body: `${input.actorDisplayName} deducted 10 points from you. Reason: ${input.reason}.`,
    actionLabel: "View activity",
    actionHref: "/?tab=activity",
    entityType: "PointTransaction",
    entityId: input.transactionId,
    dedupeKey: `point-deduction-received:${input.organizationId}:${input.transactionId}`,
  };
}

export function buildPointReactionNotificationData(input: {
  organizationId: string;
  recipientUserId: string;
  actorUserId: string;
  actorDisplayName: string;
  reactionKey: PointReactionKey;
  transactionId: string;
  reactionId: string;
}): NotificationRow {
  return {
    organizationId: input.organizationId,
    recipientUserId: input.recipientUserId,
    type: "POINT_REACTION_RECEIVED",
    severity: "INFO",
    title: "Someone reacted to your recognition",
    body: `${input.actorDisplayName} reacted with ${POINT_REACTION_LABELS[input.reactionKey]}.`,
    actionLabel: "View activity",
    actionHref: "/?tab=activity",
    entityType: "PointReaction",
    entityId: input.reactionId,
    dedupeKey: `point-reaction-received:${input.organizationId}:${input.transactionId}:${input.actorUserId}`,
  };
}

export function buildSeasonStartedNotificationData(input: {
  organizationId: string;
  recipientId: string;
  actorDisplayName: string;
  seasonName: string;
  seasonId: string;
}): NotificationRow {
  return {
    organizationId: input.organizationId,
    recipientUserId: input.recipientId,
    type: "SEASON_STARTED",
    severity: "INFO",
    title: "Season started",
    body: `${input.actorDisplayName} started ${input.seasonName}. House standings and leaderboards now use the new season.`,
    actionLabel: "View overview",
    actionHref: "/",
    entityType: "Season",
    entityId: input.seasonId,
    dedupeKey: `season-started:${input.organizationId}:${input.seasonId}`,
  };
}

export function buildRoleChangedNotificationData(input: {
  organizationId: string;
  recipientId: string;
  actorDisplayName: string;
  targetUserDisplayName: string;
  targetUserId: string;
  previousRole: string;
  newRole: string;
}): NotificationRow {
  return {
    organizationId: input.organizationId,
    recipientUserId: input.recipientId,
    type: "ROLE_CHANGED",
    severity: "INFO",
    title: "Role changed",
    body: `${input.actorDisplayName} changed ${input.targetUserDisplayName} from ${input.previousRole} to ${input.newRole}.`,
    actionLabel: "View team",
    actionHref: "/?tab=manage&section=team",
    entityType: "User",
    entityId: input.targetUserId,
  };
}

export function buildMemberNeedsAssignmentNotificationData(input: {
  organizationId: string;
  recipientId: string;
  joinedUserName: string;
  organizationName: string;
  joinedUserId: string;
}): NotificationRow {
  return {
    organizationId: input.organizationId,
    recipientUserId: input.recipientId,
    type: "MEMBER_NEEDS_HOUSE_ASSIGNMENT",
    severity: "ACTION_REQUIRED",
    title: "New member needs a house",
    body: `${input.joinedUserName} joined ${input.organizationName} and has not been assigned to a house yet.`,
    actionLabel: "Assign house",
    actionHref: "/?tab=manage&section=team",
    entityType: "User",
    entityId: input.joinedUserId,
    dedupeKey: `member-needs-house-assignment:${input.organizationId}:${input.joinedUserId}`,
  };
}

export function buildReleaseAnnouncementNotificationData(input: {
  organizationId: string;
  recipientId: string;
  releaseId: string;
  version: string;
  title: string;
  summary: string;
  releaseNotesUrl: string;
}): NotificationRow {
  return {
    organizationId: input.organizationId,
    recipientUserId: input.recipientId,
    type: "RELEASE_ANNOUNCEMENT",
    severity: "INFO",
    title: `What's new: ${input.title}`,
    body: input.summary,
    actionLabel: "View release notes",
    actionHref: input.releaseNotesUrl,
    entityType: "ReleaseAnnouncement",
    entityId: input.releaseId,
    dedupeKey: `release-announcement:${input.version}:${input.organizationId}`,
  };
}
