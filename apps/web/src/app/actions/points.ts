"use server";

import { revalidatePath } from "next/cache";
import { pointAdjustmentResponseSchema, type Trait } from "@housepoints/contracts";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import type { AwardPointsResult } from "@/lib/action-results";
import { logInfo, logWarn } from "@/lib/logging";

export async function submitPointAdjustment(formData: FormData): Promise<void> {
  await runServerAction("submitPointAdjustment", async ({ requestId }) => {
    const targetHouseId = String(formData.get("targetHouseId") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const delta = Number(formData.get("delta") ?? 0);
    const mapping = await getCurrentUserForRequest(requestId);
    const actorAuth0Sub = mapping.auth0Sub;

    if (!mapping.houseId) {
      logWarn("web.user.house_unassigned", {
        requestId,
        userId: mapping.id,
        auth0Sub: mapping.auth0Sub,
      });
      throw new Error("You must be assigned to a house before adjusting points");
    }

    logInfo("points.adjust.requested", {
      requestId,
      actorAuth0Sub,
      targetHouseId,
      delta,
      userSub: mapping.auth0Sub,
    });

    const response = await apiFetch("/points/adjust", requestId, {
      method: "POST",
      body: JSON.stringify({
        targetHouseId,
        delta,
        reason,
      }),
    });

    const transaction = await parseApiResponse(
      response,
      pointAdjustmentResponseSchema,
      "Points could not be adjusted. Please try again.",
    );

    logInfo("points.adjust.completed", {
      requestId,
      transactionId: transaction.id,
      actorAuth0Sub,
      targetHouseId,
      delta,
    });

    revalidatePath("/");
  });
}

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
