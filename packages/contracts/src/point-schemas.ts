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

export const POINT_TRANSACTION_TYPES = ["AWARD", "DEDUCTION"] as const;
export const pointTransactionTypeSchema = z.enum(POINT_TRANSACTION_TYPES);
export type PointTransactionType = (typeof POINT_TRANSACTION_TYPES)[number];

export const POINT_REACTION_KEYS = ["clap", "heart", "fire", "party", "star", "sparkles", "trophy"] as const;
export const pointReactionKeySchema = z.enum(POINT_REACTION_KEYS);
export type PointReactionKey = (typeof POINT_REACTION_KEYS)[number];

export const POINT_REACTION_LABELS: Record<PointReactionKey, string> = {
  clap: "Applause",
  heart: "Love it",
  fire: "On fire",
  party: "Celebrate",
  star: "Great work",
  sparkles: "Sparkles",
  trophy: "Trophy",
};

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

export const deductPointsSchema = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().trim().min(3).max(240),
}).strict();

export type DeductPointsInput = z.infer<typeof deductPointsSchema>;

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

export const reactToPointTransactionSchema = z.object({
  transactionId: z.string().min(1),
  reactionKey: pointReactionKeySchema.nullable(),
}).strict();

export type ReactToPointTransactionInput = z.infer<typeof reactToPointTransactionSchema>;

export const activityReactionSummarySchema = z.object({
  reactionKey: pointReactionKeySchema,
  count: z.number().int().min(1),
});

export type ActivityReactionSummary = z.infer<typeof activityReactionSummarySchema>;

export const pointReactionResponseSchema = z.object({
  transactionId: z.string().min(1),
  myReactionKey: pointReactionKeySchema.nullable(),
  reactions: z.array(activityReactionSummarySchema),
});

export type PointReactionResponse = z.infer<typeof pointReactionResponseSchema>;

export const pointReactionDetailsRequestSchema = z.object({
  transactionId: z.string().min(1),
}).strict();

export type PointReactionDetailsRequest = z.infer<typeof pointReactionDetailsRequestSchema>;

export const pointReactionDetailSchema = z.object({
  id: z.string().min(1),
  reactionKey: pointReactionKeySchema,
  actorUserId: z.string().min(1),
  actorName: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PointReactionDetail = z.infer<typeof pointReactionDetailSchema>;

export const pointReactionDetailsResponseSchema = z.object({
  transactionId: z.string().min(1),
  reactions: z.array(pointReactionDetailSchema),
});

export type PointReactionDetailsResponse = z.infer<typeof pointReactionDetailsResponseSchema>;

export const deletedPointSchema = z.object({
  id: z.string().min(1),
  type: pointTransactionTypeSchema.default("AWARD"),
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

export const activityItemSchema = z.object({
  id: z.string(),
  type: pointTransactionTypeSchema.default("AWARD"),
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
  myReactionKey: pointReactionKeySchema.nullable().optional(),
  reactions: z.array(activityReactionSummarySchema).optional(),
});

export type ActivityItem = z.infer<typeof activityItemSchema>;
export const activityFeedSchema = z.array(activityItemSchema);

export const activityFeedRequestSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  type: pointTransactionTypeSchema.optional(),
  targetUserId: z.string().min(1).optional(),
}).strict();

export type ActivityFeedRequest = z.infer<typeof activityFeedRequestSchema>;

export const pagedActivityFeedSchema = z.object({
  items: z.array(activityItemSchema),
  nextCursor: z.string().min(1).nullable(),
});

export type PagedActivityFeed = z.infer<typeof pagedActivityFeedSchema>;

export const memberScoreSchema = z.object({
  memberId: z.string(),
  points: z.number().int(),
});

export type MemberScore = z.infer<typeof memberScoreSchema>;
export const memberScoresSchema = z.array(memberScoreSchema);
