import { z } from "zod";

export const adjustPointsSchema = z.object({
  actorAuth0Sub: z.string().min(1),
  targetUserId: z.string().min(1),
  delta: z.number().int().min(1).max(100),
  reason: z.string().min(3).max(240),
});

export type AdjustPointsInput = z.infer<typeof adjustPointsSchema>;

export const bootstrapUserSchema = z.object({
  auth0Sub: z.string().min(1),
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(120),
  organizationSlug: z.string().min(2).max(80).optional(),
});

export type BootstrapUserInput = z.infer<typeof bootstrapUserSchema>;

export const appUserSchema = z.object({
  id: z.string(),
  auth0Sub: z.string(),
  email: z.string().nullable(),
  displayName: z.string(),
  role: z.enum(["MEMBER", "ADMIN"]),
  organizationId: z.string(),
  organizationSlug: z.string(),
  houseId: z.string().nullable(),
  houseName: z.string().nullable(),
  houseColor: z.string().nullable(),
  created: z.boolean(),
});

export type AppUser = z.infer<typeof appUserSchema>;

export const orgMemberSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: z.enum(["MEMBER", "ADMIN"]),
  houseId: z.string().nullable(),
  houseName: z.string().nullable(),
  houseColor: z.string().nullable(),
});

export type OrgMember = z.infer<typeof orgMemberSchema>;

export const activityItemSchema = z.object({
  id: z.string(),
  actorName: z.string(),
  targetUserName: z.string(),
  targetHouseName: z.string(),
  targetHouseColor: z.string(),
  delta: z.number().int(),
  reason: z.string(),
  createdAt: z.string(),
});

export type ActivityItem = z.infer<typeof activityItemSchema>;

export const leaderboardEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable(),
  score: z.number().int(),
  transactions: z.number().int().nonnegative(),
  memberCount: z.number().int().nonnegative(),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const actorScopeSchema = z.object({
  actorAuth0Sub: z.string().min(1),
});

export const createHouseSchema = z.object({
  actorAuth0Sub: z.string().min(1),
  name: z.string().min(2).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#7c3aed"),
  description: z.string().max(280).optional(),
});

export const assignUserHouseSchema = z.object({
  actorAuth0Sub: z.string().min(1),
  targetUserId: z.string().min(1),
  targetHouseId: z.string().min(1),
});

export const updateProfileSchema = z.object({
  actorAuth0Sub: z.string().min(1),
  displayName: z.string().trim().min(1).max(120),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const memberScoreSchema = z.object({
  memberId: z.string(),
  points: z.number().int(),
});

export type MemberScore = z.infer<typeof memberScoreSchema>;
