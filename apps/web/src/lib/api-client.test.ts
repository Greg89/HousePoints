import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import {
  ApiResponseError,
  createApiRequester,
  parseApiResponse,
} from "@/lib/api-client";

describe("createApiRequester", () => {
  it("adds authentication and correlation headers to uncached requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const getAccessToken = vi.fn().mockResolvedValue("access-token");
    const request = createApiRequester({
      baseUrl: "https://api.example.com/",
      fetchImpl,
      getAccessToken,
      timeoutMs: 5_000,
    });

    await request("/members", "request-123", {
      method: "POST",
      body: "{}",
      headers: { "x-client-header": "present" },
    });

    expect(getAccessToken).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledOnce();

    const [url, init] = fetchImpl.mock.calls[0];
    const headers = new Headers(init?.headers);

    expect(url.toString()).toBe("https://api.example.com/members");
    expect(init).toMatchObject({
      method: "POST",
      body: "{}",
      cache: "no-store",
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(headers.get("authorization")).toBe("Bearer access-token");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-request-id")).toBe("request-123");
    expect(headers.get("x-client-header")).toBe("present");
  });

  it("preserves a caller-provided abort signal", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const request = createApiRequester({
      baseUrl: "https://api.example.com",
      fetchImpl,
      getAccessToken: async () => "access-token",
      timeoutMs: 5_000,
    });
    const controller = new AbortController();

    await request("/members", "request-123", {
      method: "POST",
      signal: controller.signal,
    });

    expect(fetchImpl.mock.calls[0][1]?.signal).toBe(controller.signal);
  });
});

describe("parseApiResponse", () => {
  const schema = z.object({ id: z.string() });
  const safeMessage = "Dashboard data could not be loaded. Please try again.";

  it("parses successful responses with the supplied schema", async () => {
    await expect(
      parseApiResponse(Response.json({ id: "item-1" }), schema, safeMessage),
    ).resolves.toEqual({ id: "item-1" });
  });

  it("preserves stable API error metadata without exposing raw messages", async () => {
    const response = Response.json(
      { code: "ACTOR_NOT_MAPPED", message: "Internal account detail" },
      { status: 403 },
    );

    const error = await parseApiResponse(response, schema, safeMessage).catch(
      (cause) => cause,
    );

    expect(error).toBeInstanceOf(ApiResponseError);
    expect(error).toMatchObject({
      statusCode: 403,
      code: "ACTOR_NOT_MAPPED",
      message: safeMessage,
    });
  });

  it("uses a stable fallback code for non-JSON error responses", async () => {
    const response = new Response("service unavailable", { status: 503 });

    await expect(
      parseApiResponse(response, schema, safeMessage),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "API_REQUEST_FAILED",
      message: safeMessage,
    });
  });

  it("rejects malformed successful responses", async () => {
    const response = Response.json({ id: 42 });

    await expect(
      parseApiResponse(response, schema, safeMessage),
    ).rejects.toMatchObject({
      statusCode: 200,
      code: "INVALID_API_RESPONSE",
      message: safeMessage,
    });
  });
});
