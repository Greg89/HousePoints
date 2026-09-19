import { z } from "zod";

export const platformOverviewRequestSchema = z.object({}).strict();

export const platformOrganizationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]),
  memberCount: z.number().int().nonnegative(),
  ownerCount: z.number().int().nonnegative(),
  lastActivityAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const platformAuditEventSchema = z.object({
  id: z.string().min(1),
  actorAuth0Sub: z.string().min(1),
  eventType: z.string().min(1),
  summary: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const platformSettingsSchema = z.object({
  organizationCreationEnabled: z.boolean(),
  maxActiveOrganizations: z.number().int().positive().nullable(),
  hardOrganizationCreationEnabled: z.boolean(),
  hardMaxActiveOrganizations: z.number().int().positive().nullable(),
  effectiveOrganizationCreationEnabled: z.boolean(),
  effectiveMaxActiveOrganizations: z.number().int().positive().nullable(),
});

export const platformOverviewSchema = z.object({
  activeOrganizationCount: z.number().int().nonnegative(),
  archivedOrganizationCount: z.number().int().nonnegative(),
  totalMemberCount: z.number().int().nonnegative(),
  settings: platformSettingsSchema,
  organizations: z.array(platformOrganizationSchema),
  recentAuditEvents: z.array(platformAuditEventSchema),
});

export const updatePlatformSettingsSchema = z.object({
  organizationCreationEnabled: z.boolean(),
  maxActiveOrganizations: z.number().int().positive().nullable(),
}).strict();

export const platformOrganizationDetailRequestSchema = z.object({
  organizationId: z.string().min(1),
}).strict();

export const platformOrganizationOwnerSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email().nullable(),
});

export const platformOrganizationDetailSchema = z.object({
  organization: platformOrganizationSchema.extend({
    archivedAt: z.string().datetime().nullable(),
    suspendedAt: z.string().datetime().nullable(),
    suspensionReason: z.string().nullable(),
    transactionCount: z.number().int().nonnegative(),
    activeInviteCount: z.number().int().nonnegative(),
    deviceCount: z.number().int().nonnegative(),
  }),
  owners: z.array(platformOrganizationOwnerSchema),
  activeInvites: z.array(z.object({
    id: z.string().min(1),
    createdByName: z.string().min(1),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })),
  recentAuditEvents: z.array(z.object({
    id: z.string().min(1),
    eventType: z.string().min(1),
    summary: z.string().min(1),
    createdAt: z.string().datetime(),
  })),
  recentErrorSignals: z.array(z.object({
    id: z.string().min(1), errorType: z.string().min(1), message: z.string().min(1), sourcePath: z.string().nullable(),
    occurrenceCount: z.number().int().positive(), firstSeenAt: z.string().datetime(), lastSeenAt: z.string().datetime(),
  })),
  recentErrorOccurrenceCount: z.number().int().nonnegative(),
});

export const updatePlatformOrganizationStatusSchema = z.object({
  organizationId: z.string().min(1),
  action: z.enum(["SUSPEND", "RESUME", "ARCHIVE", "RESTORE"]),
  confirmationSlug: z.string().min(1),
  reason: z.string().trim().min(3).max(500).optional(),
}).strict().superRefine((value, context) => {
  if (value.action === "SUSPEND" && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "A suspension reason is required" });
  }
});

export const platformOrganizationStatusResponseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]),
  suspendedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
});

export const revokePlatformOrganizationInvitesSchema = z.object({
  organizationId: z.string().min(1),
  confirmationSlug: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
}).strict();
export const revokePlatformOrganizationInvitesResponseSchema = z.object({ revokedCount: z.number().int().nonnegative() });

export const revokePlatformOrganizationInviteSchema = z.object({
  organizationId: z.string().min(1),
  inviteId: z.string().min(1),
  confirmationSlug: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
}).strict();
export const revokePlatformOrganizationInviteResponseSchema = z.object({ revoked: z.boolean() });

export const platformUserSearchSchema = z.object({ query: z.string().trim().min(2).max(120) }).strict();
export const platformUserSearchResponseSchema = z.object({
  users: z.array(z.object({
    id: z.string().min(1), displayName: z.string().min(1), email: z.string().email().nullable(), auth0Sub: z.string().min(1),
    deletionRequestedAt: z.string().datetime().nullable(), activeDeviceCount: z.number().int().nonnegative(),
    devices: z.array(z.object({
      id: z.string().min(1), organizationId: z.string().min(1), organizationName: z.string().min(1),
      platform: z.enum(["IOS", "ANDROID"]), appVersion: z.string().nullable(), locale: z.string().nullable(),
      createdAt: z.string().datetime(), lastSeenAt: z.string().datetime(),
    })),
    memberships: z.array(z.object({
      organizationId: z.string().min(1), organizationName: z.string().min(1), organizationSlug: z.string().min(1),
      role: z.enum(["MEMBER", "ADMIN", "OWNER"]), membershipStatus: z.enum(["ACTIVE", "INACTIVE"]),
      organizationStatus: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]), effectiveAccess: z.enum(["ALLOWED", "BLOCKED_MEMBERSHIP", "BLOCKED_ORGANIZATION"]),
      capabilities: z.array(z.enum(["VIEW_ORGANIZATION", "AWARD_POINTS", "MANAGE_MEMBERS", "MANAGE_ORGANIZATION"])),
    })),
  })),
});

export const revokePlatformUserDevicesSchema = z.object({
  userId: z.string().min(1),
  deviceRegistrationId: z.string().min(1).optional(),
  confirmationDisplayName: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
}).strict();
export const revokePlatformUserDevicesResponseSchema = z.object({ revokedCount: z.number().int().nonnegative() });

export type PlatformUserSearchResponse = z.infer<typeof platformUserSearchResponseSchema>;

export type PlatformOrganizationDetail = z.infer<typeof platformOrganizationDetailSchema>;

export type PlatformOverview = z.infer<typeof platformOverviewSchema>;
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;
