import type { Prisma } from "@prisma/client";
import { TRAIT_LABELS } from "@housepoints/contracts";

type NotificationRow = Prisma.NotificationCreateManyInput;

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
