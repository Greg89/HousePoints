import { z } from "zod";
import { deletedPointsSchema } from "./point-schemas.js";
import { slugSchema } from "./org-schemas.js";

export const adminUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  role: z.enum(["MEMBER", "ADMIN", "OWNER"]),
  houseId: z.string().nullable(),
});

export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminHouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable(),
});

export type AdminHouse = z.infer<typeof adminHouseSchema>;

export const createHouseSchema = z.object({
  name: z.string().min(2).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#7c3aed"),
  description: z.string().max(280).optional(),
}).strict();

export const assignUserHouseSchema = z.object({
  targetUserId: z.string().min(1),
  targetHouseId: z.string().min(1),
}).strict();

export const assignUserHouseResponseSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  houseId: z.string().min(1),
});

export type AssignUserHouseResponse = z.infer<
  typeof assignUserHouseResponseSchema
>;

export const adminAuditActionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "POINT_DELETED",
    "INVITE_CREATED",
    "INVITE_USED",
    "SEASON_STARTED",
    "ORG_SETTINGS_UPDATED",
    "POINTS_DEDUCTED",
    "USER_HOUSE_ASSIGNED",
    "USER_ROLE_CHANGED",
  ]),
  occurredAt: z.string().datetime(),
  actorName: z.string().nullable(),
  summary: z.string().min(1),
  metadata: z.record(z.string(), z.string().nullable()).default({}),
});

export type AdminAuditAction = z.infer<typeof adminAuditActionSchema>;
export const adminAuditActionsSchema = z.array(adminAuditActionSchema);

export const adminAuditRequestSchema = z.object({
  cursor: z.string().min(1).optional(),
  type: adminAuditActionSchema.shape.type.optional(),
  limit: z.number().int().min(1).max(50).default(10),
}).strict();

export type AdminAuditRequest = z.infer<typeof adminAuditRequestSchema>;

export const pagedAdminAuditActionsSchema = z.object({
  items: adminAuditActionsSchema,
  nextCursor: z.string().min(1).nullable(),
});

export type PagedAdminAuditActions = z.infer<typeof pagedAdminAuditActionsSchema>;

export const inviteStatsSchema = z.object({
  generatedCount: z.number().int().nonnegative(),
  usedCount: z.number().int().nonnegative(),
});

export type InviteStats = z.infer<typeof inviteStatsSchema>;

export const pointAdjustmentStatsSchema = z.object({
  seasonId: z.string().nullable(),
  seasonName: z.string().nullable(),
  totalDeductionCount: z.number().int().nonnegative(),
  totalDeductedPoints: z.number().int().nonnegative(),
  byHouse: z.array(z.object({
    houseId: z.string(),
    houseName: z.string(),
    houseColor: z.string(),
    deductionCount: z.number().int().nonnegative(),
    deductedPoints: z.number().int().nonnegative(),
  })),
});

export type PointAdjustmentStats = z.infer<typeof pointAdjustmentStatsSchema>;

export const adminContextSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  users: z.array(adminUserSchema),
  houses: z.array(adminHouseSchema),
  recentDeletedPoints: deletedPointsSchema,
  recentAdminActions: adminAuditActionsSchema,
  inviteStats: inviteStatsSchema,
  pointAdjustmentStats: pointAdjustmentStatsSchema,
  adminAuditNextCursor: z.string().min(1).nullable(),
});

export type AdminContext = z.infer<typeof adminContextSchema>;

export const promoteUserSchema = z.object({
  targetUserId: z.string().min(1),
  role: z.enum(["MEMBER", "ADMIN"]),
}).strict();

export type PromoteUserInput = z.infer<typeof promoteUserSchema>;

export const orgSettingsSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export type OrgSettings = z.infer<typeof orgSettingsSchema>;

export const updateOrgSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
}).strict();

export type UpdateOrgSettingsInput = z.infer<typeof updateOrgSettingsSchema>;

export const updateOrgSlugSchema = z.object({
  slug: slugSchema,
}).strict();

export type UpdateOrgSlugInput = z.infer<typeof updateOrgSlugSchema>;
