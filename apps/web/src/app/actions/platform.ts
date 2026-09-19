"use server";

import { revalidatePath } from "next/cache";
import {
  platformOverviewSchema,
  platformSettingsSchema,
  type PlatformOverview,
  type PlatformOrganizationDetail,
  platformOrganizationDetailSchema,
  platformOrganizationStatusResponseSchema,
  revokePlatformOrganizationInvitesResponseSchema,
  revokePlatformOrganizationInviteResponseSchema,
  platformUserSearchResponseSchema,
  type PlatformUserSearchResponse,
  revokePlatformUserDevicesResponseSchema,
  platformAccountDeletionQueueResponseSchema,
  type PlatformAccountDeletionQueue,
  completePlatformAccountDeletionResponseSchema,
  listPlatformSupportCasesResponseSchema,
  type PlatformSupportCaseList,
  platformSupportCaseDetailSchema,
  type PlatformSupportCaseDetail,
  createPlatformSupportCaseResponseSchema,
  platformSupportCaseMutationResponseSchema,
} from "@housepoints/contracts";
import {
  ApiResponseError,
  apiFetch,
  parseApiResponse,
  requireAuthenticatedApiContext,
} from "@/lib/api-client";
import { runServerAction } from "@/lib/action-context";

export async function readPlatformOverview(): Promise<PlatformOverview> {
  return runServerAction("readPlatformOverview", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/overview", context.requestId, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return parseApiResponse(response, platformOverviewSchema, "The platform dashboard could not be loaded.");
  });
}

export async function readPlatformSupportCases(): Promise<PlatformSupportCaseList> {
  return runServerAction("readPlatformSupportCases", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/support-cases/list", context.requestId, { method: "POST", body: JSON.stringify({}) });
    return parseApiResponse(response, listPlatformSupportCasesResponseSchema, "Support cases could not be loaded.");
  });
}

export async function readPlatformSupportCase(supportCaseId: string): Promise<PlatformSupportCaseDetail> {
  return runServerAction("readPlatformSupportCase", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/support-cases/detail", context.requestId, { method: "POST", body: JSON.stringify({ supportCaseId }) });
    return parseApiResponse(response, platformSupportCaseDetailSchema, "The support case could not be loaded.");
  });
}

export async function createPlatformSupportCase(input: { title: string; summary: string; priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"; organizationId?: string; userId?: string }): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  return runServerAction("createPlatformSupportCase", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/support-cases/create", context.requestId, { method: "POST", body: JSON.stringify(input) });
    try { const result = await parseApiResponse(response, createPlatformSupportCaseResponseSchema, "The support case could not be created."); revalidatePath("/platform/support-cases"); return { ok: true, id: result.id }; }
    catch (error) { if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) return { ok: false, message: error.message }; throw error; }
  });
}

export async function updatePlatformSupportCase(input: { supportCaseId: string; status: "OPEN" | "IN_PROGRESS" | "RESOLVED"; priority: "LOW" | "NORMAL" | "HIGH" | "URGENT" }): Promise<{ ok: true } | { ok: false; message: string }> {
  return runServerAction("updatePlatformSupportCase", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/support-cases/update", context.requestId, { method: "POST", body: JSON.stringify(input) });
    try { await parseApiResponse(response, platformSupportCaseMutationResponseSchema, "The support case could not be updated."); revalidatePath("/platform/support-cases"); revalidatePath(`/platform/support-cases/${input.supportCaseId}`); return { ok: true }; }
    catch (error) { if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) return { ok: false, message: error.message }; throw error; }
  });
}

export async function addPlatformSupportNote(input: { supportCaseId: string; body: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  return runServerAction("addPlatformSupportNote", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/support-cases/notes", context.requestId, { method: "POST", body: JSON.stringify(input) });
    try { await parseApiResponse(response, platformSupportCaseMutationResponseSchema, "The private note could not be added."); revalidatePath(`/platform/support-cases/${input.supportCaseId}`); return { ok: true }; }
    catch (error) { if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) return { ok: false, message: error.message }; throw error; }
  });
}

export async function readPlatformAccountDeletions(): Promise<PlatformAccountDeletionQueue> {
  return runServerAction("readPlatformAccountDeletions", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/account-deletions", context.requestId, { method: "POST", body: JSON.stringify({}) });
    return parseApiResponse(response, platformAccountDeletionQueueResponseSchema, "The account-deletion queue could not be loaded.");
  });
}

export async function completePlatformAccountDeletion(input: { userId: string; confirmationDisplayName: string; completionNote: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  return runServerAction("completePlatformAccountDeletion", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/account-deletions/complete", context.requestId, { method: "POST", body: JSON.stringify(input) });
    try {
      await parseApiResponse(response, completePlatformAccountDeletionResponseSchema, "Account deletion could not be completed.");
      revalidatePath("/platform/account-deletions"); revalidatePath("/platform/users");
      return { ok: true };
    } catch (error) {
      if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) return { ok: false, message: error.message };
      throw error;
    }
  });
}

export async function searchPlatformUsers(query: string): Promise<{ ok: true; data: PlatformUserSearchResponse } | { ok: false; message: string }> {
  return runServerAction("searchPlatformUsers", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/users/search", context.requestId, { method: "POST", body: JSON.stringify({ query }) });
    try { return { ok: true, data: await parseApiResponse(response, platformUserSearchResponseSchema, "Users could not be searched.") }; }
    catch (error) { if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) return { ok: false, message: error.message }; throw error; }
  });
}

export async function readPlatformOrganization(organizationId: string): Promise<PlatformOrganizationDetail> {
  return runServerAction("readPlatformOrganization", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/organizations/detail", context.requestId, { method: "POST", body: JSON.stringify({ organizationId }) });
    return parseApiResponse(response, platformOrganizationDetailSchema, "The organization could not be loaded.");
  });
}

export async function updatePlatformOrganizationStatus(input: { organizationId: string; action: "SUSPEND" | "RESUME" | "ARCHIVE" | "RESTORE"; confirmationSlug: string; reason?: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  return runServerAction("updatePlatformOrganizationStatus", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/organizations/status", context.requestId, { method: "POST", body: JSON.stringify(input) });
    try { await parseApiResponse(response, platformOrganizationStatusResponseSchema, "The organization status could not be updated."); }
    catch (error) { if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) return { ok: false, message: error.message }; throw error; }
    revalidatePath("/platform"); revalidatePath(`/platform/organizations/${input.organizationId}`); return { ok: true };
  });
}

export async function revokePlatformOrganizationInvites(input: { organizationId: string; confirmationSlug: string; reason: string }): Promise<{ ok: true; revokedCount: number } | { ok: false; message: string }> {
  return runServerAction("revokePlatformOrganizationInvites", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/organizations/revoke-invites", context.requestId, { method: "POST", body: JSON.stringify(input) });
    try {
      const result = await parseApiResponse(response, revokePlatformOrganizationInvitesResponseSchema, "Outstanding invites could not be revoked.");
      revalidatePath(`/platform/organizations/${input.organizationId}`);
      return { ok: true, revokedCount: result.revokedCount };
    } catch (error) {
      if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) return { ok: false, message: error.message };
      throw error;
    }
  });
}

export async function revokePlatformOrganizationInvite(input: { organizationId: string; inviteId: string; confirmationSlug: string; reason: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  return runServerAction("revokePlatformOrganizationInvite", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/organizations/revoke-invite", context.requestId, { method: "POST", body: JSON.stringify(input) });
    try {
      await parseApiResponse(response, revokePlatformOrganizationInviteResponseSchema, "The invitation could not be revoked.");
      revalidatePath(`/platform/organizations/${input.organizationId}`);
      return { ok: true };
    } catch (error) {
      if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) return { ok: false, message: error.message };
      throw error;
    }
  });
}

export async function revokePlatformUserDevices(input: { userId: string; deviceRegistrationId?: string; confirmationDisplayName: string; reason: string }): Promise<{ ok: true; revokedCount: number } | { ok: false; message: string }> {
  return runServerAction("revokePlatformUserDevices", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/users/revoke-devices", context.requestId, { method: "POST", body: JSON.stringify(input) });
    try {
      const result = await parseApiResponse(response, revokePlatformUserDevicesResponseSchema, "Device registrations could not be revoked.");
      return { ok: true, revokedCount: result.revokedCount };
    } catch (error) {
      if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) return { ok: false, message: error.message };
      throw error;
    }
  });
}

export async function updatePlatformSettings(input: {
  organizationCreationEnabled: boolean;
  maxActiveOrganizations: number | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return runServerAction("updatePlatformSettings", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/settings", context.requestId, {
      method: "POST",
      body: JSON.stringify(input),
    });
    try {
      await parseApiResponse(response, platformSettingsSchema, "Platform settings could not be updated.");
    } catch (error) {
      if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) {
        return { ok: false, message: error.message };
      }
      throw error;
    }
    revalidatePath("/platform");
    return { ok: true };
  });
}
