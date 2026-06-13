"use server";

import { randomUUID } from "node:crypto";
import { getAuth0Client } from "@/lib/auth0";
import { logError, logInfo, logWarn } from "@/lib/logging";

type AppUserMapping = {
  id: string;
  auth0Sub: string;
  email: string | null;
  displayName: string;
  role: "MEMBER" | "ADMIN";
  houseId: string | null;
  created: boolean;
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

export async function readSessionSummary(): Promise<{
  isAuthenticated: boolean;
  userName?: string;
  userSub?: string;
  appUserId?: string;
  houseId?: string | null;
  role?: "MEMBER" | "ADMIN";
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
    appUserId: mapping.id,
    houseId: mapping.houseId,
    role: mapping.role,
    needsHouseAssignment: !mapping.houseId,
  };
}
