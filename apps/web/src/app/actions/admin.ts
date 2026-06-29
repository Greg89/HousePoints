"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  type AdminAuditAction,
  adminContextSchema,
  adminUserSchema,
  adminHouseSchema,
  assignUserHouseResponseSchema,
  deletedPointSchema,
  inviteLinkSchema,
  orgSettingsSchema,
  pagedAdminAuditActionsSchema,
  pointAdjustmentStatsSchema,
} from "@housepoints/contracts";
import {
  ApiResponseError,
  apiFetch,
  getOptionalAuthenticatedApiContext,
  parseApiResponse,
} from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import type { CreateInviteResult, DeletePointResult, HouseAssignmentResult, HouseMutationResult, OrgSettingsMutationResult, RoleChangeResult } from "@/lib/action-results";
import { logInfo } from "@/lib/logging";
import { getActorMappingForAdmin } from "./admin-auth";

export async function createHouse(formData: FormData): Promise<HouseMutationResult> {
  return runServerAction("createHouse", async (context) => {
    const { requestId } = context;
    const actor = await getActorMappingForAdmin("createHouse", requestId);
    const name = String(formData.get("name") ?? "").trim();
    const color = String(formData.get("color") ?? "#7c3aed").trim();
    const description = String(formData.get("description") ?? "").trim() || undefined;

    if (!name) {
      return {
        ok: false,
        code: "HOUSE_NAME_REQUIRED",
        message: "House name is required.",
      };
    }

    const response = await apiFetch("/admin/houses", requestId, {
      method: "POST",
      body: JSON.stringify({
        name,
        color,
        description,
      }),
    });

    let createdHouse: Awaited<ReturnType<typeof parseHouseResponse>>;

    try {
      createdHouse = await parseHouseResponse(response);
    } catch (error) {
      if (!isExpectedAdminMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        houseName: name,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }

    logInfo("web.admin.house_created", {
      requestId,
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      houseId: createdHouse.id,
      name: createdHouse.name,
    });

    revalidatePath("/");

    return { ok: true };
  });
}

export async function updateOrgSettings(formData: FormData): Promise<OrgSettingsMutationResult> {
  return runServerAction("updateOrgSettings", async (context) => {
    const { requestId } = context;
    const actor = await getActorMappingForAdmin("updateOrgSettings", requestId);
    const name = String(formData.get("name") ?? "").trim();

    if (!name) {
      return {
        ok: false,
        code: "ORG_NAME_REQUIRED",
        message: "Organization name is required.",
      };
    }

    const response = await apiFetch("/admin/org/settings", requestId, {
      method: "POST",
      body: JSON.stringify({ name }),
    });

    try {
      const organization = await parseApiResponse(
        response,
        orgSettingsSchema,
        "The organization settings could not be updated. Please try again.",
      );

      logInfo("web.admin.org_settings_updated", {
        requestId,
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        organizationName: organization.name,
      });

      revalidatePath("/");

      return { ok: true };
    } catch (error) {
      if (!isExpectedAdminMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        organizationName: name,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }
  });
}

export async function updateOrgSlug(formData: FormData): Promise<OrgSettingsMutationResult> {
  return runServerAction("updateOrgSlug", async (context) => {
    const { requestId } = context;
    const actor = await getActorMappingForAdmin("updateOrgSlug", requestId);
    const slug = String(formData.get("slug") ?? "").trim();

    if (!slug) {
      return {
        ok: false,
        code: "ORG_SLUG_REQUIRED",
        message: "Organization slug is required.",
      };
    }

    const response = await apiFetch("/admin/org/slug", requestId, {
      method: "POST",
      body: JSON.stringify({ slug }),
    });

    try {
      const organization = await parseApiResponse(
        response,
        orgSettingsSchema,
        "The organization slug could not be updated. Please try again.",
      );

      logInfo("web.admin.org_slug_updated", {
        requestId,
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        organizationSlug: organization.slug,
      });

      revalidatePath("/");

      return { ok: true };
    } catch (error) {
      if (!isExpectedAdminMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        organizationSlug: slug,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }
  });
}

export async function assignUserHouse(formData: FormData): Promise<HouseAssignmentResult> {
  return runServerAction("assignUserHouse", async (context) => {
    const { requestId } = context;
    const actor = await getActorMappingForAdmin("assignUserHouse", requestId);
    const targetUserId = String(formData.get("targetUserId") ?? "").trim();
    const targetHouseId = String(formData.get("targetHouseId") ?? "").trim();

    if (!targetUserId || !targetHouseId) {
      return {
        ok: false,
        code: "HOUSE_ASSIGNMENT_TARGET_REQUIRED",
        message: "Target user and house are required.",
      };
    }

    const response = await apiFetch("/admin/users/assign-house", requestId, {
      method: "POST",
      body: JSON.stringify({
        targetUserId,
        targetHouseId,
      }),
    });

    let updatedUser: Awaited<ReturnType<typeof parseHouseAssignmentResponse>>;

    try {
      updatedUser = await parseHouseAssignmentResponse(response);
    } catch (error) {
      if (!isExpectedAdminMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        targetUserId,
        targetHouseId,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }

    logInfo("web.admin.user_assigned", {
      requestId,
      actorUserId: actor.id,
      targetUserId: updatedUser.id,
      targetHouseId: updatedUser.houseId,
    });

    revalidatePath("/");

    return { ok: true };
  });
}

export async function promoteUserRole(formData: FormData): Promise<RoleChangeResult> {
  return runServerAction("promoteUserRole", async (context) => {
    const { requestId } = context;
    const actor = await getActorMappingForAdmin("promoteUserRole", requestId);
    const targetUserId = String(formData.get("targetUserId") ?? "").trim();
    const role = String(formData.get("role") ?? "ADMIN").trim();

    if (!targetUserId) {
      return {
        ok: false,
        code: "ROLE_TARGET_REQUIRED",
        message: "A member is required.",
      };
    }

    if (role !== "ADMIN" && role !== "MEMBER") {
      return {
        ok: false,
        code: "ROLE_INVALID",
        message: "Role must be member or admin.",
      };
    }

    const response = await apiFetch("/admin/users/role", requestId, {
      method: "POST",
      body: JSON.stringify({
        targetUserId,
        role,
      }),
    });

    try {
      await parseApiResponse(
        response,
        adminUserSchema,
        "The member role could not be updated. Please try again.",
      );
    } catch (error) {
      if (!isExpectedAdminMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        targetUserId,
        role,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }

    logInfo("web.admin.user_role_changed", {
      requestId,
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      targetUserId,
      role,
    });

    revalidatePath("/");

    return { ok: true };
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

export async function readAdminAuditPage(
  type?: AdminAuditAction["type"],
  cursor?: string,
  requestId: string = randomUUID(),
) {
  const actor = await getActorMappingForAdmin("readAdminAuditPage", requestId);
  const response = await apiFetch("/admin/audit", requestId, {
    method: "POST",
    body: JSON.stringify({
      ...(type ? { type } : {}),
      ...(cursor ? { cursor } : {}),
    }),
  });

  const page = await parseApiResponse(
    response,
    pagedAdminAuditActionsSchema,
    "Audit history could not be loaded. Please try again.",
  );

  logInfo("web.admin.audit_loaded", {
    requestId,
    actorUserId: actor.id,
    organizationId: actor.organizationId,
    filterType: type ?? null,
    cursor: cursor ?? null,
    actions: page.items.length,
    hasNextPage: Boolean(page.nextCursor),
  });

  return page;
}

export async function readPointAdjustmentStats(
  seasonId?: string,
  requestId: string = randomUUID(),
) {
  const actor = await getActorMappingForAdmin("readPointAdjustmentStats", requestId);
  const response = await apiFetch("/admin/point-adjustments/stats", requestId, {
    method: "POST",
    body: JSON.stringify({
      ...(seasonId ? { seasonId } : {}),
    }),
  });

  const stats = await parseApiResponse(
    response,
    pointAdjustmentStatsSchema,
    "Point adjustment reporting could not be loaded. Please try again.",
  );

  logInfo("web.admin.point_adjustments_loaded", {
    requestId,
    actorUserId: actor.id,
    organizationId: actor.organizationId,
    seasonId: stats.seasonId,
    deductionCount: stats.totalDeductionCount,
    deductedPoints: stats.totalDeductedPoints,
  });

  return stats;
}

export async function createInviteLink(): Promise<CreateInviteResult> {
  return runServerAction("createInviteLink", async (context) => {
    const { requestId } = context;
    const actor = await getCurrentUserForRequest(requestId);

    const response = await apiFetch("/orgs/invite", requestId, {
      method: "POST",
      body: JSON.stringify({}),
    });

    try {
      const data = await parseApiResponse(
        response,
        inviteLinkSchema,
        "An invite could not be generated. Please try again.",
      );

      return {
        ok: true,
        token: data.token,
        joinPath: data.joinPath,
        expiresAt: data.expiresAt,
      };
    } catch (error) {
      if (!isExpectedAdminMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }
  });
}

export async function deletePointTransaction(
  transactionId: string,
  reason?: string,
): Promise<DeletePointResult> {
  return runServerAction("deletePointTransaction", async (context) => {
    const { requestId } = context;
    const actor = await getActorMappingForAdmin("deletePointTransaction", requestId);
    const trimmedTransactionId = transactionId.trim();
    const trimmedReason = reason?.trim() || undefined;

    if (!trimmedTransactionId) {
      return {
        ok: false,
        code: "POINT_TRANSACTION_REQUIRED",
        message: "A point transaction is required.",
      };
    }

    const response = await apiFetch("/points/delete", requestId, {
      method: "POST",
      body: JSON.stringify({
        transactionId: trimmedTransactionId,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      }),
    });

    try {
      const deletedPoint = await parseApiResponse(
        response,
        deletedPointSchema,
        "The point award could not be deleted. Please try again.",
      );

      logInfo("web.points.deleted", {
        requestId,
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        transactionId: deletedPoint.id,
      });

      revalidatePath("/");

      return { ok: true };
    } catch (error) {
      if (!isExpectedAdminMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        transactionId: trimmedTransactionId,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }
  });
}

function parseHouseResponse(response: Response) {
  return parseApiResponse(
    response,
    adminHouseSchema,
    "The house could not be created. Please try again.",
  );
}

function parseHouseAssignmentResponse(response: Response) {
  return parseApiResponse(
    response,
    assignUserHouseResponseSchema,
    "The user could not be assigned to that house. Please try again.",
  );
}

function isExpectedAdminMutationFailure(error: unknown): error is ApiResponseError {
  return error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500;
}
