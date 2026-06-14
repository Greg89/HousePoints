"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAuth0Client } from "@/lib/auth0";
import { logError, logInfo, logWarn } from "@/lib/logging";
import type {
  ActivityItem,
  LeaderboardEntry,
  MemberScore,
  OrgMember,
  Trait,
  UserRole,
} from "@housepoints/contracts";

type AppUserMapping = {
  id: string;
  auth0Sub: string;
  email: string | null;
  displayName: string;
  role: UserRole;
  organizationId: string | null;
  organizationSlug: string | null;
  houseId: string | null;
  houseName: string | null;
  houseColor: string | null;
  created: boolean;
};

type AdminUser = {
  id: string;
  displayName: string;
  email: string | null;
  role: UserRole;
  houseId: string | null;
};

type AdminHouse = {
  id: string;
  name: string;
};

function getApiBaseUrl(): string {
  const apiBaseUrl = process.env.APP_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error("APP_API_BASE_URL is not configured");
  }

  return apiBaseUrl;
}

async function ensureAppUserMapping(input: {
  requestId: string;
  auth0Sub: string;
  email?: string;
  displayName?: string;
}): Promise<AppUserMapping> {
  const response = await fetch(`${getApiBaseUrl()}/users/bootstrap`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": input.requestId,
    },
    body: JSON.stringify({
      auth0Sub: input.auth0Sub,
      email: input.email,
      displayName: input.displayName ?? "Unknown User",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    logWarn("web.user.mapping_failed", {
      requestId: input.requestId,
      auth0Sub: input.auth0Sub,
      statusCode: response.status,
      responseBody: body,
    });
    throw new Error(`User mapping bootstrap failed with status ${response.status}`);
  }

  const user = (await response.json()) as AppUserMapping;

  logInfo("web.user.mapping_ensured", {
    requestId: input.requestId,
    userId: user.id,
    auth0Sub: user.auth0Sub,
    created: user.created,
    hasHouse: Boolean(user.houseId),
  });

  return user;
}

export async function submitPointAdjustment(formData: FormData): Promise<void> {
  const requestId = randomUUID();
  const auth0 = getAuth0Client();

  logInfo("web.action.invoked", {
    action: "submitPointAdjustment",
    requestId,
  });

  if (!auth0) {
    logWarn("web.auth.not_configured", {
      action: "submitPointAdjustment",
      requestId,
    });
    throw new Error("Auth0 is not configured");
  }

  const session = await auth0.getSession();

  if (!session) {
    logWarn("web.auth.session_missing", {
      action: "submitPointAdjustment",
      requestId,
    });
    throw new Error("You must be logged in to adjust points");
  }

  const targetHouseId = String(formData.get("targetHouseId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const delta = Number(formData.get("delta") ?? 0);
  const actorAuth0Sub = session.user.sub;
  const mapping = await ensureAppUserMapping({
    requestId,
    auth0Sub: session.user.sub,
    email: session.user.email,
    displayName: session.user.name,
  });

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
    userSub: session.user.sub,
  });

  try {
    const response = await fetch(`${getApiBaseUrl()}/points/adjust`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        actorAuth0Sub,
        targetHouseId,
        delta,
        reason,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      logWarn("web.action.failed", {
        action: "submitPointAdjustment",
        requestId,
        statusCode: response.status,
        responseBody: body,
      });
      throw new Error(`Point adjustment failed with status ${response.status}`);
    }

    const transaction = (await response.json()) as { id: string };

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
  const auth0 = getAuth0Client();

  if (!auth0) {
    logWarn("web.auth.not_configured", { action, requestId });
    throw new Error("Auth0 is not configured");
  }

  const session = await auth0.getSession();

  if (!session) {
    logWarn("web.auth.session_missing", { action, requestId });
    throw new Error("You must be logged in");
  }

  const mapping = await ensureAppUserMapping({
    requestId,
    auth0Sub: session.user.sub,
    email: session.user.email,
    displayName: session.user.name,
  });

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

  const response = await fetch(`${getApiBaseUrl()}/admin/houses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify({
      actorAuth0Sub: actor.auth0Sub,
      name,
      color,
      description,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    logWarn("web.admin.house_create_failed", {
      requestId,
      actorUserId: actor.id,
      statusCode: response.status,
      responseBody: body,
    });
    throw new Error(`Create house failed with status ${response.status}`);
  }

  logInfo("web.admin.house_created", {
    requestId,
    actorUserId: actor.id,
    organizationId: actor.organizationId,
    name,
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

  const response = await fetch(`${getApiBaseUrl()}/admin/users/assign-house`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify({
      actorAuth0Sub: actor.auth0Sub,
      targetUserId,
      targetHouseId,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    logWarn("web.admin.assignment_failed", {
      requestId,
      actorUserId: actor.id,
      targetUserId,
      targetHouseId,
      statusCode: response.status,
      responseBody: body,
    });
    throw new Error(`Assign house failed with status ${response.status}`);
  }

  logInfo("web.admin.user_assigned", {
    requestId,
    actorUserId: actor.id,
    targetUserId,
    targetHouseId,
  });

  revalidatePath("/");
}

export async function readAdminContext(): Promise<{
  organizationId: string;
  organizationSlug: string;
  users: AdminUser[];
  houses: AdminHouse[];
} | null> {
  const requestId = randomUUID();
  const auth0 = getAuth0Client();

  if (!auth0) {
    return null;
  }

  const session = await auth0.getSession();
  if (!session) {
    return null;
  }

  const mapping = await ensureAppUserMapping({
    requestId,
    auth0Sub: session.user.sub,
    email: session.user.email,
    displayName: session.user.name,
  });

  if (mapping.role !== "ADMIN" && mapping.role !== "OWNER") {
    return null;
  }

  const response = await fetch(`${getApiBaseUrl()}/admin/context`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify({
      actorAuth0Sub: mapping.auth0Sub,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    logWarn("web.admin.context_failed", {
      requestId,
      actorUserId: mapping.id,
      statusCode: response.status,
      responseBody: body,
    });
    return null;
  }

  const context = (await response.json()) as {
    organizationId: string;
    organizationSlug: string;
    users: AdminUser[];
    houses: AdminHouse[];
  };

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

  const auth0 = getAuth0Client();

  if (!auth0) {
    logWarn("web.auth.not_configured", {
      action: "readSessionSummary",
      requestId,
    });
    return { isAuthenticated: false };
  }

  const session = await auth0.getSession();

  if (!session) {
    logWarn("web.auth.session_missing", {
      action: "readSessionSummary",
      requestId,
    });

    return { isAuthenticated: false };
  }

  const summary = {
    isAuthenticated: true,
    userName: session.user.name,
    userEmail: session.user.email,
    userSub: session.user.sub,
  };

  const mapping = await ensureAppUserMapping({
    requestId,
    auth0Sub: session.user.sub,
    email: session.user.email,
    displayName: session.user.name,
  });

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
  const auth0 = getAuth0Client();
  if (!auth0) return null;
  const session = await auth0.getSession();
  if (!session) return null;
  const mapping = await ensureAppUserMapping({
    requestId,
    auth0Sub: session.user.sub,
    email: session.user.email,
    displayName: session.user.name,
  });
  const response = await fetch(`${getApiBaseUrl()}/houses/leaderboard`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ actorAuth0Sub: mapping.auth0Sub }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as LeaderboardEntry[];
}

export async function readMembers() {
  const requestId = randomUUID();
  const auth0 = getAuth0Client();
  if (!auth0) return null;
  const session = await auth0.getSession();
  if (!session) return null;
  const mapping = await ensureAppUserMapping({
    requestId,
    auth0Sub: session.user.sub,
    email: session.user.email,
    displayName: session.user.name,
  });
  const response = await fetch(`${getApiBaseUrl()}/members`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ actorAuth0Sub: mapping.auth0Sub }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as OrgMember[];
}

export async function readActivityFeed() {
  const requestId = randomUUID();
  const auth0 = getAuth0Client();
  if (!auth0) return null;
  const session = await auth0.getSession();
  if (!session) return null;
  const mapping = await ensureAppUserMapping({
    requestId,
    auth0Sub: session.user.sub,
    email: session.user.email,
    displayName: session.user.name,
  });
  const response = await fetch(`${getApiBaseUrl()}/transactions/recent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ actorAuth0Sub: mapping.auth0Sub }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as ActivityItem[];
}

export async function readMemberScores(): Promise<MemberScore[] | null> {
  const requestId = randomUUID();
  const auth0 = getAuth0Client();
  if (!auth0) return null;
  const session = await auth0.getSession();
  if (!session) return null;
  const mapping = await ensureAppUserMapping({
    requestId,
    auth0Sub: session.user.sub,
    email: session.user.email,
    displayName: session.user.name,
  });
  const response = await fetch(`${getApiBaseUrl()}/users/scores`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ actorAuth0Sub: mapping.auth0Sub }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as MemberScore[];
}

/** Called by AwardPointsDialog – takes typed args instead of FormData */
export async function awardPoints(
  targetUserId: string,
  delta: number,
  reason: string,
  trait: Trait
): Promise<void> {
  const requestId = randomUUID();
  const auth0 = getAuth0Client();
  if (!auth0) throw new Error("Auth0 is not configured");
  const session = await auth0.getSession();
  if (!session) throw new Error("Not authenticated");
  const mapping = await ensureAppUserMapping({
    requestId,
    auth0Sub: session.user.sub,
    email: session.user.email,
    displayName: session.user.name,
  });
  const response = await fetch(`${getApiBaseUrl()}/points/adjust`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ actorAuth0Sub: mapping.auth0Sub, targetUserId, delta, reason, trait }),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Award points failed: ${body}`);
  }
  revalidatePath("/");
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const requestId = randomUUID();
  const auth0 = getAuth0Client();
  if (!auth0) throw new Error("Auth0 is not configured");
  const session = await auth0.getSession();
  if (!session) throw new Error("Not authenticated");

  const trimmed = displayName.trim();
  if (!trimmed || trimmed.length > 120) {
    throw new Error("Display name must be between 1 and 120 characters");
  }

  const mapping = await ensureAppUserMapping({
    requestId,
    auth0Sub: session.user.sub,
    email: session.user.email,
    displayName: session.user.name,
  });

  const response = await fetch(`${getApiBaseUrl()}/users/profile`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ actorAuth0Sub: mapping.auth0Sub, displayName: trimmed }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    logWarn("web.profile.update_failed", {
      requestId,
      actorUserId: mapping.id,
      statusCode: response.status,
      responseBody: body,
    });
    throw new Error(`Profile update failed with status ${response.status}`);
  }

  logInfo("web.profile.updated", {
    requestId,
    actorUserId: mapping.id,
    displayName: trimmed,
  });

  revalidatePath("/");
  revalidatePath("/settings");
}

export async function createOrg(orgName: string, orgSlug: string): Promise<void> {
  const requestId = randomUUID();
  const auth0 = getAuth0Client();
  if (!auth0) throw new Error("Auth0 is not configured");
  const session = await auth0.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await fetch(`${getApiBaseUrl()}/orgs/create`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({
      auth0Sub: session.user.sub,
      email: session.user.email,
      displayName: session.user.name ?? "Unknown User",
      orgName: orgName.trim(),
      orgSlug: orgSlug.trim(),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(body.message ?? `Create org failed with status ${response.status}`);
  }

  revalidatePath("/");
}

export async function joinOrg(inviteToken: string): Promise<void> {
  const requestId = randomUUID();
  const auth0 = getAuth0Client();
  if (!auth0) throw new Error("Auth0 is not configured");
  const session = await auth0.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await fetch(`${getApiBaseUrl()}/orgs/join`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({
      auth0Sub: session.user.sub,
      email: session.user.email,
      displayName: session.user.name ?? "Unknown User",
      inviteToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(body.message ?? `Join org failed with status ${response.status}`);
  }

  revalidatePath("/");
}

export async function createInviteLink(): Promise<{ token: string; expiresAt: string }> {
  const requestId = randomUUID();
  const auth0 = getAuth0Client();
  if (!auth0) throw new Error("Auth0 is not configured");
  const session = await auth0.getSession();
  if (!session) throw new Error("Not authenticated");

  const mapping = await ensureAppUserMapping({
    requestId,
    auth0Sub: session.user.sub,
    email: session.user.email,
    displayName: session.user.name,
  });

  const response = await fetch(`${getApiBaseUrl()}/orgs/invite`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ actorAuth0Sub: mapping.auth0Sub }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(body.message ?? `Create invite failed with status ${response.status}`);
  }

  const data = await response.json();
  return { token: data.token, expiresAt: data.expiresAt };
}
