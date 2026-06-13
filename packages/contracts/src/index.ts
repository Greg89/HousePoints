import { z } from "zod";

export const adjustPointsSchema = z.object({
  actorUserId: z.string().min(1),
  targetHouseId: z.string().min(1),
  delta: z.number().int().min(-100).max(100),
  reason: z.string().min(3).max(240),
});

export type AdjustPointsInput = z.infer<typeof adjustPointsSchema>;

export const leaderboardEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number().int(),
  transactions: z.number().int().nonnegative(),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
