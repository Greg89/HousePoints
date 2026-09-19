import { z } from "zod";

export const platformOverviewRequestSchema = z.object({}).strict();

export const platformOrganizationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
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

export type PlatformOverview = z.infer<typeof platformOverviewSchema>;
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;
