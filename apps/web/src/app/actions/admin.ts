"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  adminContextSchema,
  adminHouseSchema,
  assignUserHouseResponseSchema,
  inviteLinkSchema,
} from "@housepoints/contracts";
import {
  apiFetch,
  getOptionalAuthenticatedApiContext,
  parseApiResponse,
} from "@/lib/api-client";
import { runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { logInfo } from "@/lib/logging";
import { getActorMappingForAdmin } from "./admin-auth";

export async function createHouse(formData: FormData): Promise<void> {
  await runServerAction("createHouse", async ({ requestId }) => {
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
  });
}

export async function assignUserHouse(formData: FormData): Promise<void> {
  await runServerAction("assignUserHouse", async ({ requestId }) => {
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
  });
}

export async function readAdminContext(requestId: string = randomUUID()) {
  const authContext = await getOptionalAuthenticatedApiContext();
  if (!authContext) {
    return null;
  }

  const mapping = await getCurrentUserForRequest(requestId);

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

export async function createInviteLink(): Promise<{ token: string; expiresAt: string }> {
  return runServerAction("createInviteLink", async ({ requestId }) => {
    await getCurrentUserForRequest(requestId);

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
  });
}
