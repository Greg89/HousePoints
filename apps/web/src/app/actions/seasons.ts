"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  memberScoresSchema,
  seasonContextSchema,
  seasonComparisonSchema,
  seasonPlanContextSchema,
  seasonPlanSchema,
  seasonSchema,
  seasonTransitionSchema,
  saveSeasonPlanSchema,
  updateSeasonPlannedEndSchema,
  discardSeasonPlanSchema,
  kickoffSeasonSchema,
  type DashboardSummary,
  type LeaderboardEntry,
  type MemberScore,
  type Season,
  type SeasonComparison,
  type SeasonContext,
  type SeasonPlan,
  type SeasonPlanContext,
  type SeasonTransition,
} from "@housepoints/contracts";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import type {
  RenameSeasonResult,
  SaveSeasonPlanResult,
  StartSeasonResult,
} from "@/lib/action-results";
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

export async function readSeasonPlanContext(
  requestId: string = randomUUID(),
): Promise<SeasonPlanContext> {
  await getCurrentUserForRequest(requestId);
  const response = await apiFetch("/seasons/plan-context", requestId, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return parseApiResponse(
    response,
    seasonPlanContextSchema,
    "Season planning details could not be loaded. Please try again.",
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

export async function kickoffSeason(formData: FormData): Promise<StartSeasonResult<SeasonTransition>> {
  return runServerAction("kickoffSeason", async (context) => {
    const { requestId } = context;
    const actor = await getActorMappingForAdmin("kickoffSeason", requestId);
    const parsed = kickoffSeasonSchema.safeParse({
      expectedActiveSeasonId: String(formData.get("expectedActiveSeasonId") ?? ""),
      expectedPlanVersion: Number(formData.get("expectedPlanVersion")),
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "SEASON_KICKOFF_INVALID",
        message: "Refresh the season plan before kicking it off.",
      };
    }

    const response = await apiFetch("/seasons/kickoff", requestId, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    let transition: SeasonTransition;
    try {
      transition = await parseApiResponse(
        response,
        seasonTransitionSchema,
        "The prepared season could not be started. Please try again.",
      );
    } catch (error) {
      if (!isExpectedSeasonMutationFailure(error)) throw error;
      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        expectedActiveSeasonId: parsed.data.expectedActiveSeasonId,
        expectedPlanVersion: parsed.data.expectedPlanVersion,
      });
      return { ok: false, code: error.code, message: error.message };
    }

    logInfo("web.seasons.started", {
      requestId,
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      seasonId: transition.activeSeason.id,
    });
    revalidatePath("/");
    return { ok: true, transition };
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

export async function saveSeasonPlan(
  formData: FormData,
): Promise<SaveSeasonPlanResult<SeasonPlan>> {
  return runServerAction("saveSeasonPlan", async (context) => {
    const { requestId } = context;
    const actor = await getActorMappingForAdmin("saveSeasonPlan", requestId);
    const expectedVersion = Number(formData.get("expectedVersion"));
    const parsed = saveSeasonPlanSchema.safeParse({
      expectedVersion,
      name: String(formData.get("name") ?? ""),
      kickoffMessage: String(formData.get("kickoffMessage") ?? "").trim() || null,
      plannedStartsAt: String(formData.get("plannedStartsAt") ?? "") || null,
      plannedEndsAt: String(formData.get("plannedEndsAt") ?? "") || null,
      timezone: String(formData.get("timezone") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "SEASON_PLAN_INVALID",
        message: parsed.error.issues[0]?.message ?? "Check the season plan and try again.",
      };
    }

    const response = await apiFetch("/seasons/plan", requestId, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    let plan: SeasonPlan;
    try {
      plan = await parseApiResponse(
        response,
        seasonPlanSchema,
        "The season plan could not be saved. Please try again.",
      );
    } catch (error) {
      if (!isExpectedSeasonMutationFailure(error)) throw error;
      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        expectedVersion,
      });
      return { ok: false, code: error.code, message: error.message };
    }

    revalidatePath("/");
    return { ok: true, plan };
  });
}

export async function discardSeasonPlan(formData: FormData): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  return runServerAction("discardSeasonPlan", async (context) => {
    const { requestId } = context;
    const actor = await getActorMappingForAdmin("discardSeasonPlan", requestId);
    const parsed = discardSeasonPlanSchema.safeParse({
      expectedVersion: Number(formData.get("expectedVersion")),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "SEASON_PLAN_INVALID",
        message: "Refresh the season plan before discarding it.",
      };
    }

    const response = await apiFetch("/seasons/plan/discard", requestId, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    try {
      await parseApiResponse(
        response,
        z.object({ discarded: z.literal(true) }),
        "The season plan could not be discarded. Please try again.",
      );
    } catch (error) {
      if (!isExpectedSeasonMutationFailure(error)) throw error;
      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        expectedVersion: parsed.data.expectedVersion,
      });
      return { ok: false, code: error.code, message: error.message };
    }
    revalidatePath("/");
    return { ok: true };
  });
}

export async function updateSeasonPlannedEnd(
  formData: FormData,
): Promise<RenameSeasonResult<Season>> {
  return runServerAction("updateSeasonPlannedEnd", async (context) => {
    const { requestId } = context;
    const actor = await getActorMappingForAdmin("updateSeasonPlannedEnd", requestId);
    const parsed = updateSeasonPlannedEndSchema.safeParse({
      seasonId: String(formData.get("seasonId") ?? ""),
      plannedEndsAt: String(formData.get("plannedEndsAt") ?? "") || null,
      timezone: String(formData.get("timezone") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "SEASON_PLAN_INVALID",
        message: parsed.error.issues[0]?.message ?? "Check the planned end and try again.",
      };
    }

    const response = await apiFetch("/seasons/planned-end", requestId, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    let season: Season;
    try {
      season = await parseApiResponse(
        response,
        seasonSchema,
        "The planned season end could not be saved. Please try again.",
      );
    } catch (error) {
      if (!isExpectedSeasonMutationFailure(error)) throw error;
      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
      });
      return { ok: false, code: error.code, message: error.message };
    }
    revalidatePath("/");
    return { ok: true, season };
  });
}

function isExpectedSeasonMutationFailure(error: unknown): error is ApiResponseError {
  return error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500;
}
