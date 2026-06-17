"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  apiFetch,
  getOptionalAuthenticatedApiContext,
  parseApiResponse,
  requireAuthenticatedApiContext,
} from "@/lib/api-client";
import { getCurrentUser } from "@/lib/current-user";
import { logError, logInfo, logWarn } from "@/lib/logging";
import {
  adminHouseSchema,
  adminContextSchema,
  activityFeedSchema,
  appUserSchema,
  assignUserHouseResponseSchema,
  dashboardSummarySchema,
  inviteLinkSchema,
  leaderboardSchema,
  memberScoresSchema,
  orgMembersSchema,
  pointAdjustmentResponseSchema,
  type Trait,
  type UserRole,
  updateProfileResponseSchema,
} from "@housepoints/contracts";

export async function submitPointAdjustment(formData: FormData): Promise<void> {
  const requestId = randomUUID();

  logInfo("web.action.invoked", {
    action: "submitPointAdjustment",
    requestId,
  });

  const targetHouseId = String(formData.get("targetHouseId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const delta = Number(formData.get("delta") ?? 0);
  const mapping = await getCurrentUser();
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

  try {
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

    logInfo("web.action.completed", {
      action: "submitPointAdjustment",
      requestId,
    });

    revalidatePath("/");
  } catch (error) {
    logError("web.action.failed", {
      action: "submitPointAdjustment",
      requestId,
      actorAuth0Sub,
      targetHouseId,
      delta,
      reason,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}

async function getActorMappingForAdmin(action: string, requestId: string) {
  const mapping = await getCurrentUser();

  if (mapping.role !== "ADMIN" && mapping.role !== "OWNER") {
    logWarn("web.admin.forbidden", {
      action,
      requestId,
      actorUserId: mapping.id,
      role: mapping.role,
    });
    throw new Error("Admin role required");
  }

  return mapping;
}

export async function createHouse(formData: FormData): Promise<void> {
  const requestId = randomUUID();
  const actor = await getActorMappingForAdmin("createHouse", requestId);
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#7c3aed").trim();
  const description = String(formData.get("description") ?? "").trim() || undefined;

  if (!name) {
    throw new Error("House name is required");
  }

  const response = await apiFetch("/admin/houses", requestId, {
    method: "POST",
    body: JSON.stringify({
      name,
      color,
      description,
    }),
  });

  const createdHouse = await parseApiResponse(
    response,
    adminHouseSchema,
    "The house could not be created. Please try again.",
  );

  logInfo("web.admin.house_created", {
    requestId,
    actorUserId: actor.id,
    organizationId: actor.organizationId,
    houseId: createdHouse.id,
    name: createdHouse.name,
  });

  revalidatePath("/");
}

export async function assignUserHouse(formData: FormData): Promise<void> {
  const requestId = randomUUID();
  const actor = await getActorMappingForAdmin("assignUserHouse", requestId);
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const targetHouseId = String(formData.get("targetHouseId") ?? "").trim();

  if (!targetUserId || !targetHouseId) {
    throw new Error("Target user and house are required");
  }

  const response = await apiFetch("/admin/users/assign-house", requestId, {
    method: "POST",
    body: JSON.stringify({
      targetUserId,
      targetHouseId,
    }),
  });

  const updatedUser = await parseApiResponse(
    response,
    assignUserHouseResponseSchema,
    "The user could not be assigned to that house. Please try again.",
  );

  logInfo("web.admin.user_assigned", {
    requestId,
    actorUserId: actor.id,
    targetUserId: updatedUser.id,
    targetHouseId: updatedUser.houseId,
  });

  revalidatePath("/");
}

export async function readAdminContext() {
  const requestId = randomUUID();
  const authContext = await getOptionalAuthenticatedApiContext();
  if (!authContext) {
    return null;
  }

  const mapping = await getCurrentUser();

  if (mapping.role !== "ADMIN" && mapping.role !== "OWNER") {
    return null;
  }

  const response = await apiFetch("/admin/context", requestId, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const context = await parseApiResponse(
    response,
    adminContextSchema,
    "Admin tools could not be loaded. Please try again.",
  );

  logInfo("web.admin.context_loaded", {
    requestId,
    actorUserId: mapping.id,
    organizationId: context.organizationId,
    users: context.users.length,
    houses: context.houses.length,
  });

  return context;
}

export async function readSessionSummary(): Promise<{
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
  const requestId = randomUUID();

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

  const mapping = await getCurrentUser();

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

export async function readLeaderboard() {
  const requestId = randomUUID();
  await getCurrentUser();
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

export async function readMembers() {
  const requestId = randomUUID();
  await getCurrentUser();
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

export async function readActivityFeed() {
  const requestId = randomUUID();
  await getCurrentUser();
  const response = await apiFetch("/transactions/recent", requestId, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return parseApiResponse(
    response,
    activityFeedSchema,
    "Dashboard data could not be loaded. Please try again.",
  );
}

export async function readMemberScores() {
  const requestId = randomUUID();
  await getCurrentUser();
  const response = await apiFetch("/users/scores", requestId, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return parseApiResponse(
    response,
    memberScoresSchema,
    "Dashboard data could not be loaded. Please try again.",
  );
}

export async function readDashboardSummary() {
  const requestId = randomUUID();
  await getCurrentUser();
  const response = await apiFetch("/dashboard/summary", requestId, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return parseApiResponse(
    response,
    dashboardSummarySchema,
    "Dashboard summary could not be loaded. Please try again.",
  );
}

/** Called by AwardPointsDialog – takes typed args instead of FormData */
export async function awardPoints(
  targetUserId: string,
  delta: number,
  reason: string,
  trait: Trait
): Promise<void> {
  const requestId = randomUUID();
  await getCurrentUser();
  const response = await apiFetch("/points/adjust", requestId, {
    method: "POST",
    body: JSON.stringify({ targetUserId, delta, reason, trait }),
  });
  await parseApiResponse(
    response,
    pointAdjustmentResponseSchema,
    "Points could not be awarded. Please try again.",
  );
  revalidatePath("/");
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const requestId = randomUUID();

  const trimmed = displayName.trim();
  if (!trimmed || trimmed.length > 120) {
    throw new Error("Display name must be between 1 and 120 characters");
  }

  await getCurrentUser();

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
}

export async function createOrg(
  orgName: string,
  orgSlug: string,
  firstHouseName: string,
  firstHouseColor: string,
): Promise<void> {
  const requestId = randomUUID();
  const { user } = await requireAuthenticatedApiContext();

  const response = await apiFetch("/orgs/create", requestId, {
    method: "POST",
    body: JSON.stringify({
      email: user.email,
      displayName: user.name ?? "Unknown User",
      orgName: orgName.trim(),
      orgSlug: orgSlug.trim(),
      firstHouseName: firstHouseName.trim(),
      firstHouseColor,
    }),
  });

  await parseApiResponse(
    response,
    appUserSchema,
    "The organisation could not be created. Please try again.",
  );

  revalidatePath("/");
}

export async function joinOrg(inviteToken: string): Promise<void> {
  const requestId = randomUUID();
  const { user } = await requireAuthenticatedApiContext();

  const response = await apiFetch("/orgs/join", requestId, {
    method: "POST",
    body: JSON.stringify({
      email: user.email,
      displayName: user.name ?? "Unknown User",
      inviteToken,
    }),
  });

  await parseApiResponse(
    response,
    appUserSchema,
    "The invite could not be joined. Please try again.",
  );

  revalidatePath("/");
}

export async function createInviteLink(): Promise<{ token: string; expiresAt: string }> {
  const requestId = randomUUID();
  await getCurrentUser();

  const response = await apiFetch("/orgs/invite", requestId, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const data = await parseApiResponse(
    response,
    inviteLinkSchema,
    "An invite could not be generated. Please try again.",
  );
  return { token: data.token, expiresAt: data.expiresAt };
}
