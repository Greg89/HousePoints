"use server";

import { revalidatePath } from "next/cache";
import { pointAdjustmentResponseSchema, type Trait } from "@housepoints/contracts";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import type { AwardPointsResult, DeductPointsResult } from "@/lib/action-results";

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

/** Called by DeductPointsDialog - server derives the fixed deduction amount */
export async function deductPoints(
  targetUserId: string,
  reason: string,
): Promise<DeductPointsResult> {
  return runServerAction("deductPoints", async (context) => {
    const { requestId } = context;
    await getCurrentUserForRequest(requestId);
    const response = await apiFetch("/points/deduct", requestId, {
      method: "POST",
      body: JSON.stringify({ targetUserId, reason }),
    });

    try {
      await parseApiResponse(
        response,
        pointAdjustmentResponseSchema,
        "Points could not be deducted. Please try again.",
      );
    } catch (error) {
      if (!isExpectedPointMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        targetUserId,
      });

      return {
        ok: false,
        code: error.code,
        message: getDeductPointsMessage(error),
      };
    }

    revalidatePath("/");

    return { ok: true };
  });
}

function isExpectedPointMutationFailure(error: unknown): error is ApiResponseError {
  return error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500;
}

function getDeductPointsMessage(error: ApiResponseError) {
  if (error.code === "POINT_ADJUSTMENTS_DISABLED") {
    return "Point adjustments are not enabled for this environment.";
  }

  if (error.code === "DEDUCTION_COOLDOWN_ACTIVE") {
    return "Your house has already deducted points in the last 24 hours.";
  }

  if (error.code === "TARGET_DEDUCTION_LIMIT_ACTIVE") {
    return "This member has already received a deduction in the last 24 hours.";
  }

  if (error.code === "SAME_HOUSE_TARGET") {
    return "Points can only be deducted from members in another house.";
  }

  return error.message;
}
