"use server";

import { randomUUID } from "node:crypto";
import {
  activityFeedSchema,
  dashboardSummarySchema,
  leaderboardSchema,
  orgMembersSchema,
  pagedActivityFeedSchema,
  pointReactionResponseSchema,
  type PointReactionKey,
  type PointReactionResponse,
  type ActivityFeedRequest,
  type DashboardSummary,
  type PagedActivityFeed,
} from "@housepoints/contracts";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import type { PointReactionResult } from "@/lib/action-results";
import { getCurrentUserForRequest } from "@/lib/current-user";

export async function readLeaderboard(requestId: string = randomUUID()) {
  await getCurrentUserForRequest(requestId);
  const response = await apiFetch("/houses/leaderboard", requestId, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return parseApiResponse(
    response,
    leaderboardSchema,
    "Dashboard data could not be loaded. Please try again.",
  );
}

export async function readSeasonLeaderboard(
  seasonId?: string,
  requestId: string = randomUUID(),
) {
  await getCurrentUserForRequest(requestId);
  const response = await apiFetch("/houses/leaderboard", requestId, {
    method: "POST",
    body: JSON.stringify(seasonId ? { seasonId } : {}),
  });
  return parseApiResponse(
    response,
    leaderboardSchema,
    "Dashboard data could not be loaded. Please try again.",
  );
}

export async function readMembers(requestId: string = randomUUID()) {
  await getCurrentUserForRequest(requestId);
  const response = await apiFetch("/members", requestId, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return parseApiResponse(
    response,
    orgMembersSchema,
    "Dashboard data could not be loaded. Please try again.",
  );
}

export async function readActivityPage(
  request: Pick<ActivityFeedRequest, "cursor" | "type" | "targetUserId"> = {},
  requestId: string = randomUUID(),
): Promise<PagedActivityFeed> {
  await getCurrentUserForRequest(requestId);
  const response = await apiFetch("/transactions/recent", requestId, {
    method: "POST",
    body: JSON.stringify(request),
  });
  return parseApiResponse(
    response,
    pagedActivityFeedSchema,
    "Dashboard data could not be loaded. Please try again.",
  );
}

export async function readActivityFeed(requestId: string = randomUUID()) {
  const page = await readActivityPage({}, requestId);
  return activityFeedSchema.parse(page.items);
}

export async function reactToPointTransaction(
  transactionId: string,
  reactionKey: PointReactionKey | null,
): Promise<PointReactionResult<PointReactionResponse>> {
  return runServerAction("reactToPointTransaction", async (context) => {
    const { requestId } = context;
    const trimmedTransactionId = transactionId.trim();

    if (!trimmedTransactionId) {
      return {
        ok: false,
        code: "POINT_TRANSACTION_REQUIRED",
        message: "Point transaction is required.",
      };
    }

    await getCurrentUserForRequest(requestId);
    const response = await apiFetch("/transactions/react", requestId, {
      method: "POST",
      body: JSON.stringify({
        transactionId: trimmedTransactionId,
        reactionKey,
      }),
    });

    try {
      const reaction = await parseApiResponse(
        response,
        pointReactionResponseSchema,
        "Reaction could not be saved. Please try again.",
      );

      return { ok: true, reaction };
    } catch (error) {
      if (!(error instanceof ApiResponseError) || error.statusCode < 400 || error.statusCode >= 500) {
        throw error;
      }

      logServerActionFailed(context, error, {
        transactionId: trimmedTransactionId,
        reactionKey,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }
  });
}

export async function readDashboardSummary(
  seasonId?: string,
  requestId: string = randomUUID(),
): Promise<DashboardSummary> {
  await getCurrentUserForRequest(requestId);
  const response = await apiFetch("/dashboard/summary", requestId, {
    method: "POST",
    body: JSON.stringify(seasonId ? { seasonId } : {}),
  });
  return parseApiResponse(
    response,
    dashboardSummarySchema,
    "Dashboard summary could not be loaded. Please try again.",
  );
}
