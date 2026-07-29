/**
 * Native API client. Mirrors the header + error contract of the web client in
 * `apps/web/src/lib/api-client.ts`:
 *   - `authorization: Bearer <accessToken>` for authenticated calls
 *   - `x-request-id` for SEQ correlation
 *   - `x-housepoints-organization-slug` when an active org is set
 *   - Typed `ApiResponseError` on non-2xx with `code` + `statusCode`
 *
 * Kept intentionally small for the spike. Phase 1 will wrap this in TanStack
 * Query + parse responses with Zod schemas from `@housepoints/contracts`.
 */

import { env } from "./env";
import { generateRequestId } from "./request-id";

const DEFAULT_TIMEOUT_MS = 10_000;

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

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string;
  organizationSlug?: string | null;
  requestId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

function buildUrl(path: string): string {
  const base = env.apiBaseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const requestId = options.requestId ?? generateRequestId();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const headers = new Headers({
    "content-type": "application/json",
    "x-request-id": requestId,
  });
  if (options.accessToken) {
    headers.set("authorization", `Bearer ${options.accessToken}`);
  }
  if (options.organizationSlug) {
    headers.set("x-housepoints-organization-slug", options.organizationSlug);
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal ?? controller.signal;

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    let code = "API_REQUEST_FAILED";
    let message = `API request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { code?: unknown; message?: unknown };
      if (typeof body.code === "string") code = body.code;
      if (typeof body.message === "string") message = body.message;
    } catch {
      // Non-JSON error body; keep defaults.
    }
    throw new ApiResponseError(response.status, code, message);
  }

  return (await response.json()) as T;
}
