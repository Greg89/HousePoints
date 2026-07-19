import type { FastifyRequest, RouteOptions } from "fastify";
import { describe, expect, it } from "vitest";
import {
  applyMutationRateLimit,
  GLOBAL_RATE_LIMIT,
  rateLimitKey,
} from "./rate-limits";

describe("rate limits", () => {
  it("keys authenticated traffic by Auth0 subject", () => {
    const request = {
      auth: { subject: "auth0|member" },
      ip: "127.0.0.1",
    } as FastifyRequest;

    expect(rateLimitKey(request)).toBe("user:auth0|member");
  });

  it("falls back to IP for public or unauthenticated traffic", () => {
    const request = {
      auth: undefined,
      ip: "127.0.0.1",
    } as unknown as FastifyRequest;

    expect(rateLimitKey(request)).toBe("ip:127.0.0.1");
  });

  it("applies stricter per-route limits only to mutations", () => {
    const mutation = {
      url: "/seasons/start",
      config: {},
    } as RouteOptions;
    const read = {
      url: "/seasons/compare",
      config: {},
    } as RouteOptions;

    applyMutationRateLimit(mutation);
    applyMutationRateLimit(read);

    expect(mutation.config.rateLimit).toEqual({
      max: 5,
      timeWindow: GLOBAL_RATE_LIMIT.timeWindow,
    });
    expect(read.config.rateLimit).toBeUndefined();
  });
});

