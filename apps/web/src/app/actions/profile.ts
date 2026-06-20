"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { updateProfileResponseSchema, type UserRole } from "@housepoints/contracts";
import {
  apiFetch,
  getOptionalAuthenticatedApiContext,
  parseApiResponse,
} from "@/lib/api-client";
import { runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
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

  logInfo("web.session.read", {
    requestId,
    userSub: summary.userSub,
    appUserId: mapping.id,
    hasHouse: Boolean(mapping.houseId),
  });

  logInfo("web.action.completed", {
    action: "readSessionSummary",
    requestId,
  });

  return {
    ...summary,
    userName: mapping.displayName,  // DB is source of truth; Auth0 token may be stale
    appUserId: mapping.id,
    organizationId: mapping.organizationId,
    organizationSlug: mapping.organizationSlug,
    houseId: mapping.houseId,
    houseName: mapping.houseName,
    houseColor: mapping.houseColor,
    role: mapping.role,
    needsOrg: !mapping.organizationId,
    needsHouseAssignment: !!mapping.organizationId && !mapping.houseId,
  };
}

export async function updateDisplayName(displayName: string): Promise<void> {
  await runServerAction("updateDisplayName", async ({ requestId }) => {
    const trimmed = displayName.trim();
    if (!trimmed || trimmed.length > 120) {
      throw new Error("Display name must be between 1 and 120 characters");
    }

    await getCurrentUserForRequest(requestId);

    const response = await apiFetch("/users/profile", requestId, {
      method: "POST",
      body: JSON.stringify({ displayName: trimmed }),
    });

    const updated = await parseApiResponse(
      response,
      updateProfileResponseSchema,
      "Your display name could not be updated. Please try again.",
    );

    logInfo("web.profile.updated", {
      requestId,
      actorUserId: updated.id,
      displayName: updated.displayName,
    });

    revalidatePath("/");
    revalidatePath("/settings");
  });
}
