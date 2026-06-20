"use server";

import { randomUUID } from "node:crypto";
import {
  activityFeedSchema,
  dashboardSummarySchema,
  leaderboardSchema,
  orgMembersSchema,
  pagedActivityFeedSchema,
  type DashboardSummary,
} from "@housepoints/contracts";
import { apiFetch, parseApiResponse } from "@/lib/api-client";
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

export async function readActivityFeed(requestId: string = randomUUID()) {
  await getCurrentUserForRequest(requestId);
  const response = await apiFetch("/transactions/recent", requestId, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const page = await parseApiResponse(
    response,
    pagedActivityFeedSchema,
    "Dashboard data could not be loaded. Please try again.",
  );
  return activityFeedSchema.parse(page.items);
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
