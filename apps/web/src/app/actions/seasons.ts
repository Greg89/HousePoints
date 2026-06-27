"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  memberScoresSchema,
  seasonContextSchema,
  seasonComparisonSchema,
  seasonSchema,
  seasonTransitionSchema,
  type DashboardSummary,
  type LeaderboardEntry,
  type MemberScore,
  type Season,
  type SeasonComparison,
  type SeasonContext,
  type SeasonTransition,
} from "@housepoints/contracts";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import type { RenameSeasonResult, StartSeasonResult } from "@/lib/action-results";
import { logInfo } from "@/lib/logging";
import { getActorMappingForAdmin } from "./admin-auth";
import { readDashboardSummary, readSeasonLeaderboard } from "./dashboard";

export async function readMemberScores(
  seasonId?: string,
  requestId: string = randomUUID(),
): Promise<MemberScore[]> {
  await getCurrentUserForRequest(requestId);
  const response = await apiFetch("/users/scores", requestId, {
    method: "POST",
    body: JSON.stringify(seasonId ? { seasonId } : {}),
  });
  return parseApiResponse(
    response,
    memberScoresSchema,
    "Dashboard data could not be loaded. Please try again.",
  );
}

export async function readSeasonContext(requestId: string = randomUUID()): Promise<SeasonContext> {
  await getCurrentUserForRequest(requestId);
  const response = await apiFetch("/seasons/context", requestId, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return parseApiResponse(
    response,
    seasonContextSchema,
    "Season context could not be loaded. Please try again.",
  );
}

export async function readSeasonComparison(
  fromSeasonId: string,
  toSeasonId: string,
  requestId: string = randomUUID(),
): Promise<SeasonComparison> {
  await getCurrentUserForRequest(requestId);
  const response = await apiFetch("/seasons/compare", requestId, {
    method: "POST",
    body: JSON.stringify({ fromSeasonId, toSeasonId }),
  });
  return parseApiResponse(
    response,
    seasonComparisonSchema,
    "Season comparison could not be loaded. Please try again.",
  );
}

export async function readSeasonReports(seasonId?: string): Promise<{
  dashboardSummary: DashboardSummary;
  leaderboard: LeaderboardEntry[];
  memberPoints: MemberScore[];
}> {
  return runServerAction("readSeasonReports", async ({ requestId }) => {
    const [dashboardSummary, leaderboard, memberPoints] = await Promise.all([
      readDashboardSummary(seasonId, requestId),
      readSeasonLeaderboard(seasonId, requestId),
      readMemberScores(seasonId, requestId),
    ]);

    return { dashboardSummary, leaderboard, memberPoints };
  });
}

export async function startSeason(formData: FormData): Promise<StartSeasonResult<SeasonTransition>> {
  return runServerAction("startSeason", async (context) => {
    const { requestId } = context;
    const actor = await getActorMappingForAdmin("startSeason", requestId);

    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return {
        ok: false,
        code: "SEASON_NAME_REQUIRED",
        message: "Season name is required.",
      };
    }

    const response = await apiFetch("/seasons/start", requestId, {
      method: "POST",
      body: JSON.stringify({ name }),
    });

    let transition: SeasonTransition;

    try {
      transition = await parseApiResponse(
        response,
        seasonTransitionSchema,
        "The season could not be started. Please try again.",
      );
    } catch (error) {
      if (!isExpectedSeasonMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        name,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }

    logInfo("web.seasons.started", {
      requestId,
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      name,
    });

    revalidatePath("/");
    return {
      ok: true,
      transition,
    };
  });
}

export async function renameSeason(formData: FormData): Promise<RenameSeasonResult<Season>> {
  return runServerAction("renameSeason", async (context) => {
    const { requestId } = context;
    const actor = await getActorMappingForAdmin("renameSeason", requestId);
    const seasonId = String(formData.get("seasonId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();

    if (!seasonId || !name) {
      return {
        ok: false,
        code: "SEASON_RENAME_TARGET_REQUIRED",
        message: "Season and name are required.",
      };
    }

    const response = await apiFetch("/seasons/rename", requestId, {
      method: "POST",
      body: JSON.stringify({ seasonId, name }),
    });

    let season: Season;

    try {
      season = await parseApiResponse(
        response,
        seasonSchema,
        "The season could not be renamed. Please try again.",
      );
    } catch (error) {
      if (!isExpectedSeasonMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        seasonId,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }

    logInfo("web.seasons.renamed", {
      requestId,
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      seasonId,
    });

    revalidatePath("/");
    return {
      ok: true,
      season,
    };
  });
}

function isExpectedSeasonMutationFailure(error: unknown): error is ApiResponseError {
  return error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500;
}
