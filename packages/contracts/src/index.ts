import { z } from "zod";

export const adjustPointsSchema = z.object({
  actorAuth0Sub: z.string().min(1),
  targetHouseId: z.string().min(1),
  delta: z.number().int().min(-100).max(100),
  reason: z.string().min(3).max(240),
});

export type AdjustPointsInput = z.infer<typeof adjustPointsSchema>;

export const bootstrapUserSchema = z.object({
  auth0Sub: z.string().min(1),
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(120),
});

export type BootstrapUserInput = z.infer<typeof bootstrapUserSchema>;

export const appUserSchema = z.object({
  id: z.string(),
  auth0Sub: z.string(),
  email: z.string().nullable(),
  displayName: z.string(),
  role: z.enum(["MEMBER", "ADMIN"]),
  houseId: z.string().nullable(),
  created: z.boolean(),
});

export type AppUser = z.infer<typeof appUserSchema>;

export const leaderboardEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number().int(),
  transactions: z.number().int().nonnegative(),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
