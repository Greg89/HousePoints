import { z } from "zod";
import { traitSchema, activityItemSchema } from "./point-schemas.js";
import { seasonSchema } from "./season-schemas.js";

const dashboardStandoutSchema = z.object({
  memberId: z.string(),
  memberName: z.string(),
  houseId: z.string(),
  houseName: z.string(),
  houseColor: z.string(),
  points: z.number().int(),
});

const seasonWinnerSummarySchema = z.object({
  seasonId: z.string(),
  seasonName: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  winningHouse: z.object({
    houseId: z.string(),
    houseName: z.string(),
    houseColor: z.string(),
    points: z.number().int(),
  }).nullable(),
  topContributor: dashboardStandoutSchema.nullable(),
  totalTransactions: z.number().int().nonnegative(),
  awardCount: z.number().int().nonnegative(),
  deductionCount: z.number().int().nonnegative(),
  awardedPoints: z.number().int().nonnegative(),
  deductedPoints: z.number().int().nonnegative(),
});

export type SeasonWinnerSummary = z.infer<typeof seasonWinnerSummarySchema>;

export const dashboardSummarySchema = z.object({
  generatedAt: z.string().datetime(),
  selectedSeason: seasonSchema,
  seasonWinnerSummary: seasonWinnerSummarySchema.nullable(),
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
