"use server";

import { revalidatePath } from "next/cache";
import { appUserSchema } from "@housepoints/contracts";
import {
  apiFetch,
  parseApiResponse,
  requireAuthenticatedApiContext,
} from "@/lib/api-client";
import { runServerAction } from "@/lib/action-context";

export async function createOrg(
  orgName: string,
  orgSlug: string,
  firstHouseName: string,
  firstHouseColor: string,
): Promise<void> {
  await runServerAction("createOrg", async ({ requestId }) => {
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
  });
}

export async function joinOrg(inviteToken: string): Promise<void> {
  await runServerAction("joinOrg", async ({ requestId }) => {
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
  });
}
