import { z } from "zod";
import { pointMutationKeySchema, traitSchema } from "./point-schemas.js";

export const RECOGNITION_CATEGORY_API_VERSION = "categories-v1" as const;
export const recognitionCategoryApiVersionSchema = z.literal(RECOGNITION_CATEGORY_API_VERSION);

export const recognitionCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(60),
  description: z.string().max(240).nullable(),
  legacyTrait: traitSchema.nullable(),
  createdAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
});

export type RecognitionCategory = z.infer<typeof recognitionCategorySchema>;

export const recognitionCategoryReferenceSchema = recognitionCategorySchema.pick({
  id: true,
  name: true,
  legacyTrait: true,
  archivedAt: true,
});

export type RecognitionCategoryReference = z.infer<typeof recognitionCategoryReferenceSchema>;

export const listRecognitionCategoriesSchema = z.object({
  includeArchived: z.boolean().default(true),
}).strict();

export const recognitionCategoryListResponseSchema = z.object({
  apiVersion: recognitionCategoryApiVersionSchema,
  categories: z.array(recognitionCategorySchema),
});

export const createRecognitionCategorySchema = z.object({
  idempotencyKey: pointMutationKeySchema,
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).nullable().optional(),
}).strict();

export const archiveRecognitionCategorySchema = z.object({
  categoryId: z.string().min(1),
}).strict();

export const recognitionCategoryMutationResponseSchema = z.object({
  apiVersion: recognitionCategoryApiVersionSchema,
  category: recognitionCategorySchema,
});