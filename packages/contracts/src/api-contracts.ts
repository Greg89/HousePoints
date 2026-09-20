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
  removeOrgMemberResponseSchema,
  removeOrgMemberSchema,
  updateMemberDisplayNameSchema,
  transferOwnerSchema,
  adminUserSchema,
  archiveOrgResponseSchema,
  archiveOrgSchema,
  restoreOrgResponseSchema,
  restoreOrgSchema,
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
  orgCreationAvailabilityRequestSchema,
  orgCreationAvailabilitySchema,
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
  reactToPointTransactionSchema,
  pointReactionDetailsRequestSchema,
  pointReactionDetailsResponseSchema,
  pointReactionResponseSchema,
} from "./point-schemas.js";
import {
  appUserSchema,
  orgMembersSchema,
  bootstrapUserSchema,
  updateProfileSchema,
  updateProfileResponseSchema,
  requestAccountDeletionSchema,
  requestAccountDeletionResponseSchema,
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
import {
  broadcastReleaseAnnouncementResponseSchema,
  broadcastReleaseAnnouncementSchema,
  createReleaseAnnouncementSchema,
  releaseAnnouncementSchema,
} from "./release-schemas.js";
import {
  registerDeviceRequestSchema,
  registerDeviceResponseSchema,
  unregisterDeviceRequestSchema,
  unregisterDeviceResponseSchema,
} from "./device-schemas.js";
import { reportClientErrorSchema, reportClientErrorResponseSchema } from "./telemetry-schemas.js";
import {
  platformOverviewRequestSchema,
  platformOverviewSchema,
  updatePlatformSettingsSchema,
  platformSettingsSchema,
  platformOrganizationDetailRequestSchema,
  platformOrganizationDetailSchema,
  updatePlatformOrganizationStatusSchema,
  platformOrganizationStatusResponseSchema,
  revokePlatformOrganizationInvitesSchema,
  revokePlatformOrganizationInvitesResponseSchema,
  revokePlatformOrganizationInviteSchema,
  revokePlatformOrganizationInviteResponseSchema,
  platformUserSearchSchema,
  platformUserSearchResponseSchema,
  revokePlatformUserDevicesSchema,
  revokePlatformUserDevicesResponseSchema,
  platformAccountDeletionQueueRequestSchema,
  platformAccountDeletionQueueResponseSchema,
  completePlatformAccountDeletionSchema,
  completePlatformAccountDeletionResponseSchema,
  listPlatformSupportCasesSchema,
  listPlatformSupportCasesResponseSchema,
  createPlatformSupportCaseSchema,
  createPlatformSupportCaseResponseSchema,
  readPlatformSupportCaseSchema,
  platformSupportCaseDetailSchema,
  updatePlatformSupportCaseSchema,
  addPlatformSupportNoteSchema,
  platformSupportCaseMutationResponseSchema,
  submitModerationReportSchema,
  submitModerationReportResponseSchema,
  listPlatformModerationReportsSchema,
  listPlatformModerationReportsResponseSchema,
  resolvePlatformModerationReportSchema,
  resolvePlatformModerationReportResponseSchema,
} from "./platform-schemas.js";

type ApiContract<Req extends z.ZodTypeAny, Res extends z.ZodTypeAny> = {
  request: Req;
  response: Res;
  error: typeof apiErrorSchema;
};

function defineContract<Req extends z.ZodTypeAny, Res extends z.ZodTypeAny>(
  request: Req,
  response: Res,
): ApiContract<Req, Res> {
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
  "/admin/org/owner": defineContract(transferOwnerSchema, adminUserSchema),
  "/admin/org/archive": defineContract(archiveOrgSchema, archiveOrgResponseSchema),
  "/admin/org/restore": defineContract(restoreOrgSchema, restoreOrgResponseSchema),
  "/admin/point-adjustments/stats": defineContract(
    seasonScopedRequestSchema,
    pointAdjustmentStatsSchema,
  ),
  "/admin/users/assign-house": defineContract(
    assignUserHouseSchema,
    assignUserHouseResponseSchema,
  ),
  "/admin/users/remove": defineContract(
    removeOrgMemberSchema,
    removeOrgMemberResponseSchema,
  ),
  "/admin/users/display-name": defineContract(updateMemberDisplayNameSchema, adminUserSchema),
  "/admin/users/role": defineContract(promoteUserSchema, adminUserSchema),
  "/dashboard/summary": defineContract(
    seasonScopedRequestSchema,
    dashboardSummarySchema,
  ),
  "/devices/register": defineContract(registerDeviceRequestSchema, registerDeviceResponseSchema),
  "/devices/unregister": defineContract(unregisterDeviceRequestSchema, unregisterDeviceResponseSchema),
  "/houses/leaderboard": defineContract(seasonScopedRequestSchema, leaderboardSchema),
  "/members": defineContract(actorScopeSchema, orgMembersSchema),
  "/notifications/list": defineContract(notificationListRequestSchema, pagedNotificationsSchema),
  "/notifications/mark-all-read": defineContract(actorScopeSchema, notificationMutationResponseSchema),
  "/notifications/mark-read": defineContract(markNotificationsReadSchema, notificationMutationResponseSchema),
  "/system/releases/broadcast": defineContract(
    broadcastReleaseAnnouncementSchema,
    broadcastReleaseAnnouncementResponseSchema,
  ),
  "/system/releases/record": defineContract(createReleaseAnnouncementSchema, releaseAnnouncementSchema),
  "/orgs/create": defineContract(createOrgSchema, appUserSchema),
  "/orgs/create-availability": defineContract(
    orgCreationAvailabilityRequestSchema,
    orgCreationAvailabilitySchema,
  ),
  "/orgs/invite": defineContract(createInviteSchema, inviteLinkSchema),
  "/orgs/join/preview": defineContract(joinInvitePreviewSchema, joinInvitePreviewResponseSchema),
  "/orgs/join": defineContract(joinOrgSchema, appUserSchema),
  "/orgs/route-context": defineContract(orgRouteContextRequestSchema, orgRouteContextSchema),
  "/platform/overview": defineContract(platformOverviewRequestSchema, platformOverviewSchema),
  "/platform/settings": defineContract(updatePlatformSettingsSchema, platformSettingsSchema),
  "/telemetry/client-error": defineContract(reportClientErrorSchema, reportClientErrorResponseSchema),
  "/platform/organizations/detail": defineContract(platformOrganizationDetailRequestSchema, platformOrganizationDetailSchema),
  "/platform/organizations/status": defineContract(updatePlatformOrganizationStatusSchema, platformOrganizationStatusResponseSchema),
  "/platform/organizations/revoke-invites": defineContract(revokePlatformOrganizationInvitesSchema, revokePlatformOrganizationInvitesResponseSchema),
  "/platform/organizations/revoke-invite": defineContract(revokePlatformOrganizationInviteSchema, revokePlatformOrganizationInviteResponseSchema),
  "/platform/users/search": defineContract(platformUserSearchSchema, platformUserSearchResponseSchema),
  "/platform/users/revoke-devices": defineContract(revokePlatformUserDevicesSchema, revokePlatformUserDevicesResponseSchema),
  "/platform/account-deletions": defineContract(platformAccountDeletionQueueRequestSchema, platformAccountDeletionQueueResponseSchema),
  "/platform/account-deletions/complete": defineContract(completePlatformAccountDeletionSchema, completePlatformAccountDeletionResponseSchema),
  "/platform/support-cases/list": defineContract(listPlatformSupportCasesSchema, listPlatformSupportCasesResponseSchema),
  "/platform/support-cases/create": defineContract(createPlatformSupportCaseSchema, createPlatformSupportCaseResponseSchema),
  "/platform/support-cases/detail": defineContract(readPlatformSupportCaseSchema, platformSupportCaseDetailSchema),
  "/platform/support-cases/update": defineContract(updatePlatformSupportCaseSchema, platformSupportCaseMutationResponseSchema),
  "/platform/support-cases/notes": defineContract(addPlatformSupportNoteSchema, platformSupportCaseMutationResponseSchema),
  "/moderation/reports/submit": defineContract(submitModerationReportSchema, submitModerationReportResponseSchema),
  "/platform/moderation/reports": defineContract(listPlatformModerationReportsSchema, listPlatformModerationReportsResponseSchema),
  "/platform/moderation/reports/resolve": defineContract(resolvePlatformModerationReportSchema, resolvePlatformModerationReportResponseSchema),
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
  "/transactions/react": defineContract(
    reactToPointTransactionSchema,
    pointReactionResponseSchema,
  ),
  "/transactions/reactions": defineContract(
    pointReactionDetailsRequestSchema,
    pointReactionDetailsResponseSchema,
  ),
  "/users/bootstrap": defineContract(bootstrapUserSchema, appUserSchema),
  "/users/profile": defineContract(
    updateProfileSchema,
    updateProfileResponseSchema,
  ),
  "/users/account-deletion": defineContract(
    requestAccountDeletionSchema,
    requestAccountDeletionResponseSchema,
  ),
  "/users/scores": defineContract(seasonScopedRequestSchema, memberScoresSchema),
} as const;

export type ApiEndpoint = keyof typeof apiContracts;
