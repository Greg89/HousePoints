"use server";

import { revalidatePath } from "next/cache";
import { pointAdjustmentResponseSchema, type Trait } from "@housepoints/contracts";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import type { AwardPointsResult } from "@/lib/action-results";

/** Called by AwardPointsDialog - takes typed args instead of FormData */
export async function awardPoints(
  targetUserId: string,
  delta: number,
  reason: string,
  trait: Trait
): Promise<AwardPointsResult> {
  return runServerAction("awardPoints", async (context) => {
    const { requestId } = context;
    await getCurrentUserForRequest(requestId);
    const response = await apiFetch("/points/adjust", requestId, {
      method: "POST",
      body: JSON.stringify({ targetUserId, delta, reason, trait }),
    });

    try {
      await parseApiResponse(
        response,
        pointAdjustmentResponseSchema,
        "Points could not be awarded. Please try again.",
      );
    } catch (error) {
      if (!isExpectedAwardFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        targetUserId,
        delta,
        trait,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }

    revalidatePath("/");

    return { ok: true };
  });
}

function isExpectedAwardFailure(error: unknown): error is ApiResponseError {
  return error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500;
}
