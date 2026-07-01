import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "MEMBER_NEEDS_HOUSE_ASSIGNMENT",
  "INVITE_ACCEPTED",
  "ROLE_CHANGED",
  "SEASON_STARTED",
  "POINT_AWARD_RECEIVED",
  "POINT_DEDUCTION_RECEIVED",
] as const;

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_SEVERITIES = [
  "INFO",
  "ACTION_REQUIRED",
  "WARNING",
] as const;

export const notificationSeveritySchema = z.enum(NOTIFICATION_SEVERITIES);
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export const notificationSchema = z.object({
  id: z.string().min(1),
  type: notificationTypeSchema,
  severity: notificationSeveritySchema,
  title: z.string().min(1),
  body: z.string().min(1),
  actionLabel: z.string().min(1).nullable(),
  actionHref: z.string().min(1).nullable(),
  entityType: z.string().min(1).nullable(),
  entityId: z.string().min(1).nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type Notification = z.infer<typeof notificationSchema>;

export const notificationListRequestSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(10),
  unreadOnly: z.boolean().default(false),
}).strict();

export type NotificationListRequest = z.infer<typeof notificationListRequestSchema>;

export const pagedNotificationsSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).nullable(),
});

export type PagedNotifications = z.infer<typeof pagedNotificationsSchema>;

export const markNotificationsReadSchema = z.object({
  notificationIds: z.array(z.string().min(1)).min(1).max(50),
}).strict();

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

export const notificationMutationResponseSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
});

export type NotificationMutationResponse = z.infer<typeof notificationMutationResponseSchema>;
