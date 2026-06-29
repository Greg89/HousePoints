"use server";

import { revalidatePath } from "next/cache";
import { appUserSchema, joinInvitePreviewResponseSchema } from "@housepoints/contracts";
import {
  ApiResponseError,
  apiFetch,
  parseApiResponse,
  requireAuthenticatedApiContext,
} from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import type { CreateOrgResult, JoinOrgResult } from "@/lib/action-results";

export type InviteLinkPreviewResult =
  | { ok: true; organizationName: string; organizationSlug: string }
  | { ok: false; code: string; message: string };

export async function createOrg(
  orgName: string,
  orgSlug: string,
  firstHouseName: string,
  firstHouseColor: string,
): Promise<CreateOrgResult> {
  return runServerAction("createOrg", async (context) => {
    const { requestId } = context;
    const { user } = await requireAuthenticatedApiContext();
    const trimmedOrgName = orgName.trim();
    const trimmedOrgSlug = orgSlug.trim();
    const trimmedFirstHouseName = firstHouseName.trim();

    if (!trimmedOrgName || !trimmedOrgSlug || !trimmedFirstHouseName) {
      return {
        ok: false,
        code: "ORG_SETUP_REQUIRED",
        message: "Organisation name, slug, and first house are required.",
      };
    }

    const response = await apiFetch("/orgs/create", requestId, {
      method: "POST",
      body: JSON.stringify({
        email: user.email,
        displayName: user.name ?? "Unknown User",
        orgName: trimmedOrgName,
        orgSlug: trimmedOrgSlug,
        firstHouseName: trimmedFirstHouseName,
        firstHouseColor,
      }),
    });

    try {
      await parseOrgUserResponse(
        response,
        "The organisation could not be created. Please try again.",
      );
    } catch (error) {
      if (!isExpectedOrgMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        orgSlug: trimmedOrgSlug,
        firstHouseName: trimmedFirstHouseName,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }

    revalidatePath("/");

    return { ok: true };
  });
}

export async function previewInviteLink(
  organizationSlug: string,
  inviteToken: string,
): Promise<InviteLinkPreviewResult> {
  return runServerAction("previewInviteLink", async (context) => {
    const { requestId } = context;
    const trimmedInviteToken = inviteToken.trim();
    const trimmedOrganizationSlug = organizationSlug.trim();

    if (!trimmedInviteToken || !trimmedOrganizationSlug) {
      return {
        ok: false,
        code: "INVITE_LINK_REQUIRED",
        message: "Invite link is missing required information.",
      };
    }

    const response = await apiFetch("/orgs/join/preview", requestId, {
      method: "POST",
      body: JSON.stringify({
        inviteToken: trimmedInviteToken,
        organizationSlug: trimmedOrganizationSlug,
      }),
    });

    try {
      const data = await parseApiResponse(
        response,
        joinInvitePreviewResponseSchema,
        "The invite link could not be loaded. Please ask for a new invite.",
      );

      return {
        ok: true,
        organizationName: data.organizationName,
        organizationSlug: data.organizationSlug,
      };
    } catch (error) {
      if (!isExpectedOrgMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        organizationSlug: trimmedOrganizationSlug,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }
  });
}

export async function joinOrg(inviteToken: string, organizationSlug?: string): Promise<JoinOrgResult> {
  return runServerAction("joinOrg", async (context) => {
    const { requestId } = context;
    const { user } = await requireAuthenticatedApiContext();
    const trimmedInviteToken = inviteToken.trim();
    const trimmedOrganizationSlug = organizationSlug?.trim();

    if (!trimmedInviteToken) {
      return {
        ok: false,
        code: "INVITE_TOKEN_REQUIRED",
        message: "Invite token is required.",
      };
    }

    const response = await apiFetch("/orgs/join", requestId, {
      method: "POST",
      body: JSON.stringify({
        email: user.email,
        displayName: user.name ?? "Unknown User",
        inviteToken: trimmedInviteToken,
        ...(trimmedOrganizationSlug ? { organizationSlug: trimmedOrganizationSlug } : {}),
      }),
    });

    try {
      await parseOrgUserResponse(
        response,
        "The invite could not be joined. Please try again.",
      );
    } catch (error) {
      if (!isExpectedOrgMutationFailure(error)) {
        throw error;
      }

      if (trimmedOrganizationSlug) {
        logServerActionFailed(context, error, { organizationSlug: trimmedOrganizationSlug });
      } else {
        logServerActionFailed(context, error);
      }

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }

    revalidatePath("/");

    return { ok: true };
  });
}

function parseOrgUserResponse(response: Response, safeMessage: string) {
  return parseApiResponse(response, appUserSchema, safeMessage);
}

function isExpectedOrgMutationFailure(error: unknown): error is ApiResponseError {
  return error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500;
}
