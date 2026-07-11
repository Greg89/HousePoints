"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  updateProfileResponseSchema,
  type AppUserOrganizationContext,
  type UserRole,
} from "@housepoints/contracts";
import {
  ApiResponseError,
  apiFetch,
  getOptionalAuthenticatedApiContext,
  parseApiResponse,
} from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { readActiveOrganizationSlug } from "@/lib/active-organization";
import { resolveActiveAppUserMapping } from "@/lib/active-user-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import type { ProfileUpdateResult } from "@/lib/action-results";
import { logInfo, logWarn } from "@/lib/logging";

export async function readSessionSummary(requestId: string = randomUUID()): Promise<{
  isAuthenticated: boolean;
  userName?: string;
  userEmail?: string;
  userSub?: string;
  appUserId?: string;
  organizationId?: string | null;
  organizationSlug?: string | null;
  houseId?: string | null;
  houseName?: string | null;
  houseColor?: string | null;
  houseThemeMode?: "GENERATED" | "CUSTOM" | null;
  houseThemeSecondaryColor?: string | null;
  houseThemeSurfaceColor?: string | null;
  organizationContexts?: AppUserOrganizationContext[];
  houseThemeEnabled?: boolean;
  role?: UserRole;
  needsOrg?: boolean;
  needsHouseAssignment?: boolean;
}> {
  logInfo("web.action.invoked", {
    action: "readSessionSummary",
    requestId,
  });

  const authContext = await getOptionalAuthenticatedApiContext();

  if (!authContext) {
    logWarn("web.auth.session_missing", {
      action: "readSessionSummary",
      requestId,
    });

    return { isAuthenticated: false };
  }

  const summary = {
    isAuthenticated: true,
    userName: authContext.user.name,
    userEmail: authContext.user.email,
    userSub: authContext.user.sub,
  };

  const mapping = await getCurrentUserForRequest(requestId);
  const activeOrganizationSlug = await readActiveOrganizationSlug();
  const activeMapping = resolveActiveAppUserMapping(mapping, activeOrganizationSlug);
  const organizationId = activeMapping.organizationId;
  const organizationSlug = activeMapping.organizationSlug;
  const houseId = activeMapping.houseId;

  logInfo("web.session.read", {
    requestId,
    userSub: summary.userSub,
    appUserId: mapping.id,
    hasHouse: Boolean(houseId),
  });

  logInfo("web.action.completed", {
    action: "readSessionSummary",
    requestId,
  });

  return {
    ...summary,
    userName: mapping.displayName,  // DB is source of truth; Auth0 token may be stale
    appUserId: mapping.id,
    organizationId,
    organizationSlug,
    houseId,
    houseName: activeMapping.houseName,
    houseColor: activeMapping.houseColor,
    houseThemeMode: activeMapping.houseThemeMode,
    houseThemeSecondaryColor: activeMapping.houseThemeSecondaryColor,
    houseThemeSurfaceColor: activeMapping.houseThemeSurfaceColor,
    organizationContexts: activeMapping.organizationContexts,
    houseThemeEnabled: mapping.houseThemeEnabled,
    role: activeMapping.role,
    needsOrg: !organizationId,
    needsHouseAssignment: !!organizationId && !houseId,
  };
}

export async function updateDisplayName(displayName: string): Promise<ProfileUpdateResult> {
  return runServerAction("updateDisplayName", async (context) => {
    const { requestId } = context;
    const trimmed = displayName.trim();
    if (!trimmed || trimmed.length > 120) {
      return {
        ok: false,
        code: "INVALID_DISPLAY_NAME",
        message: "Display name must be between 1 and 120 characters.",
      };
    }

    await getCurrentUserForRequest(requestId);

    const response = await apiFetch("/users/profile", requestId, {
      method: "POST",
      body: JSON.stringify({ displayName: trimmed }),
    });

    let updated: Awaited<ReturnType<typeof parseProfileUpdateResponse>>;

    try {
      updated = await parseProfileUpdateResponse(response);
    } catch (error) {
      if (!isExpectedProfileUpdateFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        displayNameLength: trimmed.length,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }

    logInfo("web.profile.updated", {
      requestId,
      actorUserId: updated.id,
      displayName: updated.displayName,
    });

    revalidatePath("/");
    revalidatePath("/settings");

    return { ok: true };
  });
}

export async function updateHouseThemePreference(enabled: boolean): Promise<ProfileUpdateResult> {
  return runServerAction("updateHouseThemePreference", async (context) => {
    const { requestId } = context;

    await getCurrentUserForRequest(requestId);

    const response = await apiFetch("/users/profile", requestId, {
      method: "POST",
      body: JSON.stringify({ houseThemeEnabled: enabled }),
    });

    let updated: Awaited<ReturnType<typeof parseProfileUpdateResponse>>;

    try {
      updated = await parseProfileUpdateResponse(response);
    } catch (error) {
      if (!isExpectedProfileUpdateFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        houseThemeEnabled: enabled,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }

    logInfo("web.profile.updated", {
      requestId,
      actorUserId: updated.id,
      houseThemeEnabled: updated.houseThemeEnabled,
    });

    revalidatePath("/");
    revalidatePath("/settings");

    return { ok: true };
  });
}

function parseProfileUpdateResponse(response: Response) {
  return parseApiResponse(
    response,
    updateProfileResponseSchema,
    "Your display name could not be updated. Please try again.",
  );
}

function isExpectedProfileUpdateFailure(error: unknown): error is ApiResponseError {
  return error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500;
}
