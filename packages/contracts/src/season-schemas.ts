import { z } from "zod";

export const seasonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
});

export type Season = z.infer<typeof seasonSchema>;

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

export const seasonCompareRequestSchema = z.object({
  fromSeasonId: z.string().min(1),
  toSeasonId: z.string().min(1),
}).strict().refine(
  (input) => input.fromSeasonId !== input.toSeasonId,
  {
    message: "Comparison seasons must be different.",
    path: ["toSeasonId"],
  },
);

export type SeasonCompareRequest = z.infer<typeof seasonCompareRequestSchema>;

const seasonComparisonContributorSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  points: z.number().int(),
});

const seasonComparisonHouseMetricsSchema = z.object({
  rank: z.number().int().positive(),
  points: z.number().int(),
  transactions: z.number().int().nonnegative(),
  averagePointsPerDay: z.number(),
  topContributor: seasonComparisonContributorSchema.nullable(),
});

export const seasonComparisonHouseSchema = z.object({
  houseId: z.string().min(1),
  houseName: z.string().min(1),
  houseColor: z.string().min(1),
  from: seasonComparisonHouseMetricsSchema,
  to: seasonComparisonHouseMetricsSchema,
  delta: z.object({
    rankChange: z.number().int(),
    pointChange: z.number().int(),
    averagePointsPerDayChange: z.number(),
  }),
});

export type SeasonComparisonHouse = z.infer<typeof seasonComparisonHouseSchema>;

export const seasonComparisonSchema = z.object({
  fromSeason: seasonSchema,
  toSeason: seasonSchema,
  houses: z.array(seasonComparisonHouseSchema),
});

export type SeasonComparison = z.infer<typeof seasonComparisonSchema>;
