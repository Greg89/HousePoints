import { z } from "zod";
import { pointTransactionTypeSchema, traitSchema } from "./point-schemas.js";

export const reportScopeSchema = z.object({
  seasonId: z.string().min(1).max(128),
  houseId: z.string().min(1).max(128).optional(),
  // null selects transactions whose recipient identity is unavailable.
  memberId: z.string().min(1).max(128).nullable().optional(),
  categoryId: z.string().min(1).max(128).optional(),
  giverId: z.string().min(1).max(128).optional(),
  type: pointTransactionTypeSchema.optional(),
}).strict();

export type ReportScope = z.infer<typeof reportScopeSchema>;

export const reportPageRequestSchema = reportScopeSchema.extend({
  limit: z.number().int().min(1).max(50).default(25),
  cursor: z.string().min(1).max(2048).optional(),
}).strict();

export type ReportPageRequest = z.infer<typeof reportPageRequestSchema>;

export const reportSummarySchema = z.object({
  netPoints: z.number().int(),
  awardedPoints: z.number().int().nonnegative(),
  deductedPoints: z.number().int().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
  awardCount: z.number().int().nonnegative(),
  deductionCount: z.number().int().nonnegative(),
  // A category filters its awards; uncategorized deductions are disclosed separately.
  deductionsOutsideCategory: z.object({
    points: z.number().int().nonnegative(),
    count: z.number().int().nonnegative(),
  }).nullable(),
});

export type ReportSummary = z.infer<typeof reportSummarySchema>;

export const reportItemSchema = z.object({
  id: z.string().min(1),
  type: pointTransactionTypeSchema,
  delta: z.number().int(),
  reason: z.string(),
  trait: traitSchema.nullable(),
  category: z.object({ id: z.string(), name: z.string(), archivedAt: z.string().datetime().nullable() }).nullable(),
  house: z.object({ id: z.string(), name: z.string(), color: z.string() }),
  member: z.object({ id: z.string().nullable(), displayName: z.string() }),
  giver: z.object({ id: z.string(), displayName: z.string() }),
  createdAt: z.string().datetime(),
});

export type ReportItem = z.infer<typeof reportItemSchema>;

export const reportPageResponseSchema = z.object({
  scope: reportScopeSchema,
  revision: z.string().regex(/^(0|[1-9]\d*)$/),
  summary: reportSummarySchema,
  items: z.array(reportItemSchema),
  nextCursor: z.string().nullable(),
});

export type ReportPageResponse = z.infer<typeof reportPageResponseSchema>;
