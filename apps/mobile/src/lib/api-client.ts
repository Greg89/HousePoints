/**
 * Native API client. Mirrors the header + error contract of the web client in
 * `apps/web/src/lib/api-client.ts`:
 *   - `authorization: Bearer <accessToken>` for authenticated calls
 *   - `x-request-id` for SEQ correlation
 *   - `x-housepoints-organization-slug` when an active org is set
 *   - Typed `ApiResponseError` on non-2xx with `code` + `statusCode`
 *
 * `callApi` is the typed entry point: it looks up the request/response Zod
 * schemas from `@housepoints/contracts` so callers get end-to-end types with
 * one source of truth shared with the API and web workspaces.
 */

import {
  apiContracts,
  apiErrorSchema,
  type ApiEndpoint,
} from "@housepoints/contracts";
import type { z } from "zod";
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

export type CallApiOptions = {
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

async function postJson(
  path: string,
  body: unknown,
  options: CallApiOptions,
): Promise<unknown> {
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
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    let code = "API_REQUEST_FAILED";
    let message = `API request failed with status ${response.status}`;
    try {
      const errorJson = (await response.json()) as unknown;
      const parsed = apiErrorSchema.safeParse(errorJson);
      if (parsed.success) {
        code = parsed.data.code;
        message = parsed.data.message;
      }
    } catch {
      // Non-JSON error body; keep defaults.
    }
    throw new ApiResponseError(response.status, code, message);
  }

  return response.json();
}

/**
 * Call an API endpoint with type-safe request/response payloads derived from
 * the shared `apiContracts` registry.
 */
export async function callApi<E extends ApiEndpoint>(
  endpoint: E,
  body: z.input<(typeof apiContracts)[E]["request"]>,
  options: CallApiOptions = {},
): Promise<z.output<(typeof apiContracts)[E]["response"]>> {
  const contract = apiContracts[endpoint];
  const raw = await postJson(endpoint, body, options);
  const parsed = contract.response.safeParse(raw);
  if (!parsed.success) {
    throw new ApiResponseError(
      200,
      "INVALID_API_RESPONSE",
      `Received an unexpected response shape from ${endpoint}.`,
      { cause: parsed.error },
    );
  }
  return parsed.data as z.output<(typeof apiContracts)[E]["response"]>;
}

/**
 * Bare GET helper for endpoints outside `apiContracts` (e.g. `/health`).
 */
export async function apiGet(
  path: string,
  options: { requestId?: string; timeoutMs?: number } = {},
): Promise<unknown> {
  const requestId = options.requestId ?? generateRequestId();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: "GET",
      headers: { "x-request-id": requestId },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    throw new ApiResponseError(
      response.status,
      "API_REQUEST_FAILED",
      `API request failed with status ${response.status}`,
    );
  }

  return response.json();
}
