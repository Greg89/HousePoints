import "server-only";

import { randomUUID } from "node:crypto";
import { cache } from "react";
import { appUserSchema, type AppUser } from "@housepoints/contracts";
import {
  apiFetch,
  requireAuthenticatedApiContext,
  type AuthenticatedApiContext,
} from "@/lib/api-client";
import { logInfo, logWarn } from "@/lib/logging";

type CurrentUserDependencies = {
  getContext: () => Promise<AuthenticatedApiContext>;
  request: (
    path: string,
    requestId: string,
    init: RequestInit,
  ) => Promise<Response>;
  createRequestId: () => string;
};

export function createCurrentUserLoader(dependencies: CurrentUserDependencies) {
  return async function loadCurrentUser(): Promise<AppUser> {
    const context = await dependencies.getContext();
    const requestId = dependencies.createRequestId();
    const response = await dependencies.request(
      "/users/bootstrap",
      requestId,
      {
        method: "POST",
        body: JSON.stringify({
          email: context.user.email,
          displayName: context.user.name ?? "Unknown User",
        }),
      },
    );

    if (!response.ok) {
      const responseBody = await response.text();
      logWarn("web.user.mapping_failed", {
        requestId,
        auth0Sub: context.user.sub,
        statusCode: response.status,
        responseBody,
      });
      throw new Error(
        `User mapping bootstrap failed with status ${response.status}`,
      );
    }

    const user = appUserSchema.parse(await response.json());

    logInfo("web.user.mapping_ensured", {
      requestId,
      userId: user.id,
      auth0Sub: user.auth0Sub,
      created: user.created,
      hasHouse: Boolean(user.houseId),
    });

    return user;
  };
}

export const getCurrentUser = cache(
  createCurrentUserLoader({
    getContext: requireAuthenticatedApiContext,
    request: apiFetch,
    createRequestId: randomUUID,
  }),
);
