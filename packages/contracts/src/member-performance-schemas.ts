import { z } from "zod";
import { seasonSchema } from "./season-schemas.js";
import { reportItemSchema, reportSummarySchema } from "./report-schemas.js";

export const memberPerformanceRequestSchema = z.object({
  memberId: z.string().min(1).max(128),
  seasonId: z.string().min(1).max(128).optional(),
}).strict();

export const memberPerformanceSchema = z.object({
  member: z.object({ id: z.string(), displayName: z.string() }),
  selectedSeason: seasonSchema,
  summary: reportSummarySchema,
  recognition: z.array(z.object({ key: z.string(), label: z.string(), points: z.number().int(), count: z.number().int().nonnegative() })),
  days: z.array(z.object({ date: z.string(), points: z.number().int() })),
  recentActivity: z.array(reportItemSchema),
});
export type MemberPerformance = z.infer<typeof memberPerformanceSchema>;
