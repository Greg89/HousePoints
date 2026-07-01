import { z } from "zod";
import { apiErrorSchema } from "./shared.js";
import {
  adminAuditRequestSchema,
  pagedAdminAuditActionsSchema,
  adminContextSchema,
  createHouseSchema,
  adminHouseSchema,
  updateOrgSettingsSchema,
  orgSettingsSchema,
  updateOrgSlugSchema,
  pointAdjustmentStatsSchema,
  assignUserHouseSchema,
  assignUserHouseResponseSchema,
  promoteUserSchema,
  adminUserSchema,
} from "./admin-schemas.js";
import {
  dashboardSummarySchema,
  leaderboardSchema,
} from "./dashboard-schemas.js";
import {
  notificationListRequestSchema,
  pagedNotificationsSchema,
  markNotificationsReadSchema,
  notificationMutationResponseSchema,
} from "./notification-schemas.js";
import {
  createOrgSchema,
  createInviteSchema,
  joinOrgSchema,
  joinInvitePreviewSchema,
  joinInvitePreviewResponseSchema,
  orgRouteContextRequestSchema,
  orgRouteContextSchema,
  inviteLinkSchema,
} from "./org-schemas.js";
import {
  adjustPointsSchema,
  deductPointsSchema,
  pointAdjustmentResponseSchema,
  deletePointTransactionSchema,
  deletedPointSchema,
  activityFeedRequestSchema,
  pagedActivityFeedSchema,
  memberScoresSchema,
} from "./point-schemas.js";
import {
  appUserSchema,
  orgMembersSchema,
  bootstrapUserSchema,
  updateProfileSchema,
  updateProfileResponseSchema,
} from "./user-schemas.js";
import {
  actorScopeSchema,
  seasonScopedRequestSchema,
  seasonContextSchema,
  createSeasonSchema,
  seasonTransitionSchema,
  seasonCompareRequestSchema,
  seasonComparisonSchema,
  renameSeasonSchema,
  seasonSchema,
} from "./season-schemas.js";

type ApiContract = {
  request: z.ZodType;
  response: z.ZodType;
  error: typeof apiErrorSchema;
};

function defineContract(request: z.ZodType, response: z.ZodType): ApiContract {
  return {
    request,
    response,
    error: apiErrorSchema,
  };
}

export const apiContracts = {
  "/admin/audit": defineContract(adminAuditRequestSchema, pagedAdminAuditActionsSchema),
  "/admin/context": defineContract(actorScopeSchema, adminContextSchema),
  "/admin/houses": defineContract(createHouseSchema, adminHouseSchema),
  "/admin/org/settings": defineContract(updateOrgSettingsSchema, orgSettingsSchema),
  "/admin/org/slug": defineContract(updateOrgSlugSchema, orgSettingsSchema),
  "/admin/point-adjustments/stats": defineContract(
    seasonScopedRequestSchema,
    pointAdjustmentStatsSchema,
  ),
  "/admin/users/assign-house": defineContract(
    assignUserHouseSchema,
    assignUserHouseResponseSchema,
  ),
  "/admin/users/role": defineContract(promoteUserSchema, adminUserSchema),
  "/dashboard/summary": defineContract(
    seasonScopedRequestSchema,
    dashboardSummarySchema,
  ),
  "/houses/leaderboard": defineContract(seasonScopedRequestSchema, leaderboardSchema),
  "/members": defineContract(actorScopeSchema, orgMembersSchema),
  "/notifications/list": defineContract(notificationListRequestSchema, pagedNotificationsSchema),
  "/notifications/mark-all-read": defineContract(actorScopeSchema, notificationMutationResponseSchema),
  "/notifications/mark-read": defineContract(markNotificationsReadSchema, notificationMutationResponseSchema),
  "/orgs/create": defineContract(createOrgSchema, appUserSchema),
  "/orgs/invite": defineContract(createInviteSchema, inviteLinkSchema),
  "/orgs/join/preview": defineContract(joinInvitePreviewSchema, joinInvitePreviewResponseSchema),
  "/orgs/join": defineContract(joinOrgSchema, appUserSchema),
  "/orgs/route-context": defineContract(orgRouteContextRequestSchema, orgRouteContextSchema),
  "/points/adjust": defineContract(
    adjustPointsSchema,
    pointAdjustmentResponseSchema,
  ),
  "/points/deduct": defineContract(
    deductPointsSchema,
    pointAdjustmentResponseSchema,
  ),
  "/points/delete": defineContract(
    deletePointTransactionSchema,
    deletedPointSchema,
  ),
  "/seasons/context": defineContract(actorScopeSchema, seasonContextSchema),
  "/seasons/compare": defineContract(
    seasonCompareRequestSchema,
    seasonComparisonSchema,
  ),
  "/seasons/rename": defineContract(renameSeasonSchema, seasonSchema),
  "/seasons/start": defineContract(createSeasonSchema, seasonTransitionSchema),
  "/transactions/recent": defineContract(
    activityFeedRequestSchema,
    pagedActivityFeedSchema,
  ),
  "/users/bootstrap": defineContract(bootstrapUserSchema, appUserSchema),
  "/users/profile": defineContract(
    updateProfileSchema,
    updateProfileResponseSchema,
  ),
  "/users/scores": defineContract(seasonScopedRequestSchema, memberScoresSchema),
} as const;

export type ApiEndpoint = keyof typeof apiContracts;
