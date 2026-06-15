import "server-only";

import { cache } from "react";
import type { User } from "@auth0/nextjs-auth0/types";
import { apiErrorSchema } from "@housepoints/contracts";
import type { ZodType } from "zod";
import { getAuth0Client } from "@/lib/auth0";

const DEFAULT_TIMEOUT_MS = 10_000;

export class WebAuthenticationError extends Error {
  constructor(
    readonly code: "AUTH_NOT_CONFIGURED" | "SESSION_MISSING",
    message: string,
  ) {
    super(message);
    this.name = "WebAuthenticationError";
  }
}

export class ApiResponseError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiResponseError";
  }
}

export type AuthenticatedApiContext = {
  user: User;
  accessToken: string;
};

type ApiRequestDependencies = {
  baseUrl: string;
  fetchImpl: typeof fetch;
  getAccessToken: () => Promise<string>;
  timeoutMs: number;
};

export function createApiRequester(dependencies: ApiRequestDependencies) {
  return async function request(
    path: string,
    requestId: string,
    init: RequestInit,
  ): Promise<Response> {
    const accessToken = await dependencies.getAccessToken();
    const headers = new Headers(init.headers);

    headers.set("authorization", `Bearer ${accessToken}`);
    headers.set("content-type", "application/json");
    headers.set("x-request-id", requestId);

    return dependencies.fetchImpl(
      new URL(path, `${dependencies.baseUrl.replace(/\/$/, "")}/`),
      {
        ...init,
        headers,
        cache: "no-store",
        signal: init.signal ?? AbortSignal.timeout(dependencies.timeoutMs),
      },
    );
  };
}

export async function parseApiResponse<T>(
  response: Response,
  schema: ZodType<T>,
  safeMessage: string,
): Promise<T> {
  if (!response.ok) {
    const errorPayload = await response
      .json()
      .then((body) => apiErrorSchema.safeParse(body))
      .catch(() => null);

    throw new ApiResponseError(
      response.status,
      errorPayload?.success ? errorPayload.data.code : "API_REQUEST_FAILED",
      safeMessage,
    );
  }

  try {
    return schema.parse(await response.json());
  } catch (cause) {
    throw new ApiResponseError(
      response.status,
      "INVALID_API_RESPONSE",
      safeMessage,
      { cause },
    );
  }
}

export const getOptionalAuthenticatedApiContext = cache(
  async (): Promise<AuthenticatedApiContext | null> => {
    const auth0 = getAuth0Client();

    if (!auth0) {
      return null;
    }

    const session = await auth0.getSession();

    if (!session) {
      return null;
    }

    const { token } = await auth0.getAccessToken();

    return {
      user: session.user,
      accessToken: token,
    };
  },
);

export async function requireAuthenticatedApiContext(): Promise<AuthenticatedApiContext> {
  const auth0 = getAuth0Client();

  if (!auth0) {
    throw new WebAuthenticationError(
      "AUTH_NOT_CONFIGURED",
      "Auth0 is not configured",
    );
  }

  const context = await getOptionalAuthenticatedApiContext();

  if (!context) {
    throw new WebAuthenticationError(
      "SESSION_MISSING",
      "You must be logged in",
    );
  }

  return context;
}

export async function apiFetch(
  path: string,
  requestId: string,
  init: RequestInit,
): Promise<Response> {
  const context = await requireAuthenticatedApiContext();
  const apiBaseUrl = process.env.APP_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error("APP_API_BASE_URL is not configured");
  }

  return createApiRequester({
    baseUrl: apiBaseUrl,
    fetchImpl: fetch,
    getAccessToken: async () => context.accessToken,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  })(path, requestId, init);
}
