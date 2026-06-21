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

export const pointAdjustmentResponseSchema = z.object({
  id: z.string().min(1),
});

export type PointAdjustmentResponse = z.infer<
  typeof pointAdjustmentResponseSchema
>;

export const deletePointTransactionSchema = z.object({
  transactionId: z.string().min(1),
  reason: z.string().trim().max(240).optional(),
}).strict();

export type DeletePointTransactionInput = z.infer<typeof deletePointTransactionSchema>;

export const deletedPointSchema = z.object({
  id: z.string().min(1),
  actorName: z.string().min(1),
  targetUserName: z.string().min(1),
  targetHouseName: z.string().min(1),
  targetHouseColor: z.string().min(1),
  delta: z.number().int(),
  reason: z.string(),
  trait: traitSchema.nullable(),
  createdAt: z.string().datetime(),
  deletedAt: z.string().datetime(),
  deletedByName: z.string().nullable(),
  deletionReason: z.string().nullable(),
  season: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    isActive: z.boolean(),
  }).nullable(),
});

export type DeletedPoint = z.infer<typeof deletedPointSchema>;
export const deletedPointsSchema = z.array(deletedPointSchema);

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
export const orgMembersSchema = z.array(orgMemberSchema);

export const seasonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
});

export type Season = z.infer<typeof seasonSchema>;

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
  season: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    isActive: z.boolean(),
  }).nullable(),
});

export type ActivityItem = z.infer<typeof activityItemSchema>;
export const activityFeedSchema = z.array(activityItemSchema);

export const activityFeedRequestSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(50),
}).strict();

export type ActivityFeedRequest = z.infer<typeof activityFeedRequestSchema>;

export const pagedActivityFeedSchema = z.object({
  items: z.array(activityItemSchema),
  nextCursor: z.string().min(1).nullable(),
});

export type PagedActivityFeed = z.infer<typeof pagedActivityFeedSchema>;

const dashboardStandoutSchema = z.object({
  memberId: z.string(),
  memberName: z.string(),
  houseId: z.string(),
  houseName: z.string(),
  houseColor: z.string(),
  points: z.number().int(),
});

export const dashboardSummarySchema = z.object({
  generatedAt: z.string().datetime(),
  selectedSeason: seasonSchema,
  seasonStartsAt: z.string().datetime(),
  seasonStandout: dashboardStandoutSchema.nullable(),
  seasonStandoutsByHouse: z.array(z.object({
    houseId: z.string(),
    standout: dashboardStandoutSchema.nullable(),
  })),
  monthStartsAt: z.string().datetime(),
  monthlyStandout: dashboardStandoutSchema.nullable(),
  monthlyStandoutsByHouse: z.array(z.object({
    houseId: z.string(),
    standout: dashboardStandoutSchema.nullable(),
  })),
  traitLeaders: z.array(z.object({
    houseId: z.string(),
    houseName: z.string(),
    houseColor: z.string(),
    trait: traitSchema.nullable(),
    count: z.number().int().nonnegative(),
  })),
  recentActivity: z.array(activityItemSchema),
  pointsVelocity: z.array(z.object({
    houseId: z.string(),
    houseName: z.string(),
    houseColor: z.string(),
    days: z.array(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      points: z.number().int(),
    })),
  })),
  houseMemberRankings: z.array(z.object({
    houseId: z.string(),
    members: z.array(z.object({
      memberId: z.string(),
      displayName: z.string(),
      role: z.enum(["MEMBER", "ADMIN", "OWNER"]),
      points: z.number().int(),
    })),
  })),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

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
export const leaderboardSchema = z.array(leaderboardEntrySchema);

export const actorScopeSchema = z.object({}).strict();

export const seasonContextSchema = z.object({
  activeSeason: seasonSchema,
  seasons: z.array(seasonSchema),
});

export type SeasonContext = z.infer<typeof seasonContextSchema>;

export const seasonScopedRequestSchema = z.object({
  seasonId: z.string().min(1).optional(),
}).strict();

export type SeasonScopedRequest = z.infer<typeof seasonScopedRequestSchema>;

export const createSeasonSchema = z.object({
  name: z.string().trim().min(2).max(80),
}).strict();

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;

export const renameSeasonSchema = z.object({
  seasonId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
}).strict();

export type RenameSeasonInput = z.infer<typeof renameSeasonSchema>;

export const seasonTransitionSchema = z.object({
  previousSeason: seasonSchema,
  activeSeason: seasonSchema,
});

export type SeasonTransition = z.infer<typeof seasonTransitionSchema>;

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

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
}).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateProfileResponseSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).max(120),
});

export type UpdateProfileResponse = z.infer<
  typeof updateProfileResponseSchema
>;

export const memberScoreSchema = z.object({
  memberId: z.string(),
  points: z.number().int(),
});

export type MemberScore = z.infer<typeof memberScoreSchema>;
export const memberScoresSchema = z.array(memberScoreSchema);

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

export const adminAuditActionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "POINT_DELETED",
    "INVITE_CREATED",
    "INVITE_USED",
    "SEASON_STARTED",
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

export const adminContextSchema = z.object({
  organizationId: z.string(),
  organizationSlug: z.string(),
  users: z.array(adminUserSchema),
  houses: z.array(adminHouseSchema),
  recentDeletedPoints: deletedPointsSchema,
  recentAdminActions: adminAuditActionsSchema,
  adminAuditNextCursor: z.string().min(1).nullable(),
});

export type AdminContext = z.infer<typeof adminContextSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export type LogContext = Record<string, unknown>;

export const REDACTED_LOG_VALUE = "[REDACTED]";

const sensitiveLogKeyFragments = [
  "authorization",
  "clientsecret",
  "cookie",
  "idtoken",
  "invitetoken",
  "password",
  "refreshtoken",
  "secret",
  "token",
];

function isLogRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSensitiveLogKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");

  return sensitiveLogKeyFragments.some((fragment) => normalized.includes(fragment));
}

export function redactLogContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (isSensitiveLogKey(key)) {
        return [key, REDACTED_LOG_VALUE];
      }

      if (Array.isArray(value)) {
        return [
          key,
          value.map((item) => (isLogRecord(item) ? redactLogContext(item) : item)),
        ];
      }

      if (isLogRecord(value)) {
        return [key, redactLogContext(value)];
      }

      return [key, value];
    }),
  );
}

export function serializeErrorForLog(error: unknown): LogContext {
  if (!(error instanceof Error)) {
    return {
      errorType: typeof error,
      errorMessage: String(error),
    };
  }

  const errorWithMetadata = error as Error & {
    cause?: unknown;
    code?: unknown;
    digest?: unknown;
    statusCode?: unknown;
  };

  const context: LogContext = {
    errorName: error.name,
    errorMessage: error.message,
  };

  if (typeof errorWithMetadata.code === "string") {
    context.errorCode = errorWithMetadata.code;
  }

  if (typeof errorWithMetadata.statusCode === "number") {
    context.statusCode = errorWithMetadata.statusCode;
  }

  if (typeof errorWithMetadata.digest === "string") {
    context.digest = errorWithMetadata.digest;
  }

  if (errorWithMetadata.cause instanceof Error) {
    context.causeName = errorWithMetadata.cause.name;
    context.causeMessage = errorWithMetadata.cause.message;
  }

  return context;
}

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
  id: z.string().min(1),
  token: z.string().min(1),
  expiresAt: z.string().datetime(),
  usedAt: z.string().datetime().nullable(),
});

export type InviteLink = z.infer<typeof inviteLinkSchema>;

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
  "/admin/users/assign-house": defineContract(
    assignUserHouseSchema,
    assignUserHouseResponseSchema,
  ),
  "/admin/users/role": defineContract(promoteUserSchema, adminUserSchema),
  "/dashboard/summary": defineContract(
    seasonScopedRequestSchema,
    dashboardSummarySchema,
  ),
  "/houses/leaderboard": defineContract(actorScopeSchema, leaderboardSchema),
  "/members": defineContract(actorScopeSchema, orgMembersSchema),
  "/orgs/create": defineContract(createOrgSchema, appUserSchema),
  "/orgs/invite": defineContract(createInviteSchema, inviteLinkSchema),
  "/orgs/join": defineContract(joinOrgSchema, appUserSchema),
  "/points/adjust": defineContract(
    adjustPointsSchema,
    pointAdjustmentResponseSchema,
  ),
  "/points/delete": defineContract(
    deletePointTransactionSchema,
    deletedPointSchema,
  ),
  "/seasons/context": defineContract(actorScopeSchema, seasonContextSchema),
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
