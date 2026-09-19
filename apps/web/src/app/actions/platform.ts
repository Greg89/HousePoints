"use server";

import { revalidatePath } from "next/cache";
import {
  platformOverviewSchema,
  platformSettingsSchema,
  type PlatformOverview,
  type PlatformOrganizationDetail,
  platformOrganizationDetailSchema,
  platformOrganizationStatusResponseSchema,
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

export async function readPlatformOrganization(organizationId: string): Promise<PlatformOrganizationDetail> {
  return runServerAction("readPlatformOrganization", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/organizations/detail", context.requestId, { method: "POST", body: JSON.stringify({ organizationId }) });
    return parseApiResponse(response, platformOrganizationDetailSchema, "The organization could not be loaded.");
  });
}

export async function updatePlatformOrganizationStatus(input: { organizationId: string; action: "SUSPEND" | "RESUME"; confirmationSlug: string; reason?: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  return runServerAction("updatePlatformOrganizationStatus", async (context) => {
    await requireAuthenticatedApiContext();
    const response = await apiFetch("/platform/organizations/status", context.requestId, { method: "POST", body: JSON.stringify(input) });
    try { await parseApiResponse(response, platformOrganizationStatusResponseSchema, "The organization status could not be updated."); }
    catch (error) { if (error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500) return { ok: false, message: error.message }; throw error; }
    revalidatePath("/platform"); revalidatePath(`/platform/organizations/${input.organizationId}`); return { ok: true };
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
