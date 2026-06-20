"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  memberScoresSchema,
  seasonContextSchema,
  seasonSchema,
  seasonTransitionSchema,
  type DashboardSummary,
  type MemberScore,
  type Season,
  type SeasonContext,
  type SeasonTransition,
} from "@housepoints/contracts";
import { apiFetch, parseApiResponse } from "@/lib/api-client";
import { runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { logInfo } from "@/lib/logging";
import { getActorMappingForAdmin } from "./admin-auth";
import { readDashboardSummary } from "./dashboard";

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

export async function readSeasonReports(seasonId?: string): Promise<{
  dashboardSummary: DashboardSummary;
  memberPoints: MemberScore[];
}> {
  return runServerAction("readSeasonReports", async ({ requestId }) => {
    const [dashboardSummary, memberPoints] = await Promise.all([
      readDashboardSummary(seasonId, requestId),
      readMemberScores(seasonId, requestId),
    ]);

    return { dashboardSummary, memberPoints };
  });
}

export async function startSeason(formData: FormData): Promise<SeasonTransition> {
  return runServerAction("startSeason", async ({ requestId }) => {
    const actor = await getActorMappingForAdmin("startSeason", requestId);

    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      throw new Error("Season name is required");
    }

    const response = await apiFetch("/seasons/start", requestId, {
      method: "POST",
      body: JSON.stringify({ name }),
    });

    const transition = await parseApiResponse(
      response,
      seasonTransitionSchema,
      "The season could not be started. Please try again.",
    );

    logInfo("web.seasons.started", {
      requestId,
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      name,
    });

    revalidatePath("/");
    return transition;
  });
}

export async function renameSeason(formData: FormData): Promise<Season> {
  return runServerAction("renameSeason", async ({ requestId }) => {
    const actor = await getActorMappingForAdmin("renameSeason", requestId);
    const seasonId = String(formData.get("seasonId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();

    if (!seasonId || !name) {
      throw new Error("Season and name are required");
    }

    const response = await apiFetch("/seasons/rename", requestId, {
      method: "POST",
      body: JSON.stringify({ seasonId, name }),
    });

    const season = await parseApiResponse(
      response,
      seasonSchema,
      "The season could not be renamed. Please try again.",
    );

    logInfo("web.seasons.renamed", {
      requestId,
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      seasonId,
    });

    revalidatePath("/");
    return season;
  });
}
