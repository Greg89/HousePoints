import { z } from "zod";

export const TRAITS = [
  "LEADERSHIP",
  "OWNERSHIP",
  "COLLABORATION",
  "MENTORSHIP",
  "TECHNICAL_EXCELLENCE",
  "PROBLEM_SOLVING",
  "INNOVATION",
  "KNOWLEDGE_SHARING",
  "COMMUNICATION",
  "CUSTOMER_FOCUS",
  "RELIABILITY",
  "INITIATIVE",
  "PROCESS_IMPROVEMENT",
  "TEAM_SUPPORT",
  "ACCOUNTABILITY",
  "ADAPTABILITY",
  "POSITIVE_INFLUENCE",
  "ABOVE_AND_BEYOND",
  "CULTURE_CHAMPION",
  "UNSUNG_HERO",
] as const;

export type Trait = (typeof TRAITS)[number];

export const TRAIT_LABELS: Record<Trait, string> = {
  LEADERSHIP:          "Leadership",
  OWNERSHIP:           "Ownership",
  COLLABORATION:       "Collaboration",
  MENTORSHIP:          "Mentorship",
  TECHNICAL_EXCELLENCE:"Technical Excellence",
  PROBLEM_SOLVING:     "Problem Solving",
  INNOVATION:          "Innovation",
  KNOWLEDGE_SHARING:   "Knowledge Sharing",
  COMMUNICATION:       "Communication",
  CUSTOMER_FOCUS:      "Customer Focus",
  RELIABILITY:         "Reliability",
  INITIATIVE:          "Initiative",
  PROCESS_IMPROVEMENT: "Process Improvement",
  TEAM_SUPPORT:        "Team Support",
  ACCOUNTABILITY:      "Accountability",
  ADAPTABILITY:        "Adaptability",
  POSITIVE_INFLUENCE:  "Positive Influence",
  ABOVE_AND_BEYOND:    "Above & Beyond",
  CULTURE_CHAMPION:    "Culture Champion",
  UNSUNG_HERO:         "Unsung Hero",
};

export const traitSchema = z.enum(TRAITS);

export const adjustPointsSchema = z.object({
  targetUserId: z.string().min(1),
  delta: z.number().int().min(1).max(100),
  reason: z.string().min(3).max(240),
  trait: traitSchema,
}).strict();

export type AdjustPointsInput = z.infer<typeof adjustPointsSchema>;

export const bootstrapUserSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(120),
}).strict();

export type BootstrapUserInput = z.infer<typeof bootstrapUserSchema>;

export const appUserSchema = z.object({
  id: z.string(),
  auth0Sub: z.string(),
  email: z.string().nullable(),
  displayName: z.string(),
  role: z.enum(["MEMBER", "ADMIN", "OWNER"]),
  organizationId: z.string().nullable(),
  organizationSlug: z.string().nullable(),
  houseId: z.string().nullable(),
  houseName: z.string().nullable(),
  houseColor: z.string().nullable(),
  created: z.boolean(),
});

export type AppUser = z.infer<typeof appUserSchema>;
export type UserRole = AppUser["role"];

export const orgMemberSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: z.enum(["MEMBER", "ADMIN", "OWNER"]),
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
  trait: traitSchema.nullable(),
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

export const actorScopeSchema = z.object({}).strict();

export const createHouseSchema = z.object({
  name: z.string().min(2).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#7c3aed"),
  description: z.string().max(280).optional(),
}).strict();

export const assignUserHouseSchema = z.object({
  targetUserId: z.string().min(1),
  targetHouseId: z.string().min(1),
}).strict();

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
}).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const memberScoreSchema = z.object({
  memberId: z.string(),
  points: z.number().int(),
});

export type MemberScore = z.infer<typeof memberScoreSchema>;

// ---------------------------------------------------------------------------
// Slug validation — shared rule used by org create and invite flows
// ---------------------------------------------------------------------------
const slugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(60, "Slug must be at most 60 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen"
  );

// ---------------------------------------------------------------------------
// Org management schemas
// ---------------------------------------------------------------------------
export const createOrgSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().trim().min(1).max(120),
  orgName: z.string().trim().min(2).max(80),
  orgSlug: slugSchema,
  firstHouseName: z.string().trim().min(2).max(80),
  firstHouseColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#7c3aed"),
}).strict();

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

export const createInviteSchema = z.object({
  /** How many hours the invite is valid for. Defaults to 72. Max 168 (7 days). */
  expiresInHours: z.number().int().min(1).max(168).default(72),
}).strict();

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const joinOrgSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().trim().min(1).max(120),
  /** The raw invite token from the URL */
  inviteToken: z.string().min(1),
}).strict();

export type JoinOrgInput = z.infer<typeof joinOrgSchema>;

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

export const inviteLinkSchema = z.object({
  id: z.string(),
  url: z.string(),
  expiresAt: z.string(),
  usedAt: z.string().nullable(),
});

export type InviteLink = z.infer<typeof inviteLinkSchema>;
