import { describe, expect, it, vi } from "vitest";
import { createApiRequester } from "@/lib/api-client";

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
