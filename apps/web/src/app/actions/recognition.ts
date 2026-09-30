"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  recognitionCategoryListResponseSchema,
  recognitionCategoryMutationResponseSchema,
  type RecognitionCategory,
} from "@housepoints/contracts";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { runServerAction } from "@/lib/action-context";
import type { MutationResult } from "@/lib/action-results";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { recognitionCategoriesWebEnabled } from "@/lib/recognition-gate";

const disabled: MutationResult = {
  ok: false,
  code: "RECOGNITION_CATEGORIES_DISABLED",
  message: "Recognition category management is not enabled.",
};

export async function readRecognitionCategories(requestId: string = randomUUID()): Promise<RecognitionCategory[]> {
  if (!recognitionCategoriesWebEnabled) return [];
  return fetchRecognitionCategoriesFromApi(requestId);
}

// Bypasses the management gate; used by reports to label category chips.
export async function readRecognitionCategoriesForReports(requestId: string = randomUUID()): Promise<RecognitionCategory[]> {
  return fetchRecognitionCategoriesFromApi(requestId);
}

async function fetchRecognitionCategoriesFromApi(requestId: string): Promise<RecognitionCategory[]> {
  await getCurrentUserForRequest(requestId);
  const response = await apiFetch("/recognition-categories/list", requestId, {
    method: "POST",
    body: JSON.stringify({ includeArchived: true }),
  });
  const result = await parseApiResponse(response, recognitionCategoryListResponseSchema, "Recognition categories could not be loaded.");
  return result.categories;
}

export async function createRecognitionCategory(input: {
  name: string;
  description?: string;
  idempotencyKey: string;
}): Promise<MutationResult> {
  if (!recognitionCategoriesWebEnabled) return disabled;
  return runServerAction("createRecognitionCategory", async ({ requestId }) => {
    await getCurrentUserForRequest(requestId);
    const response = await apiFetch("/recognition-categories/create", requestId, {
      method: "POST",
      body: JSON.stringify(input),
    });
    try {
      await parseApiResponse(response, recognitionCategoryMutationResponseSchema, "Category could not be created.");
    } catch (error) {
      if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) {
        return { ok: false, code: error.code, message: error.message };
      }
      throw error;
    }
    revalidatePath("/");
    return { ok: true };
  });
}

export async function archiveRecognitionCategory(categoryId: string): Promise<MutationResult> {
  if (!recognitionCategoriesWebEnabled) return disabled;
  return runServerAction("archiveRecognitionCategory", async ({ requestId }) => {
    await getCurrentUserForRequest(requestId);
    const response = await apiFetch("/recognition-categories/archive", requestId, {
      method: "POST",
      body: JSON.stringify({ categoryId }),
    });
    try {
      await parseApiResponse(response, recognitionCategoryMutationResponseSchema, "Category could not be archived.");
    } catch (error) {
      if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) {
        return { ok: false, code: error.code, message: error.message };
      }
      throw error;
    }
    revalidatePath("/");
    return { ok: true };
  });
}
