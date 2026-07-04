import { describe, expect, it } from "vitest";
import { isPublicRequestRoute, isPublicRoute } from "./api-hooks";

describe("isPublicRoute", () => {
  it("keeps selected system routes outside bearer authentication", () => {
    expect(isPublicRoute("/health")).toBe(true);
    expect(isPublicRoute("/system/releases/record")).toBe(true);
    expect(isPublicRoute("/members")).toBe(false);
    expect(isPublicRoute(undefined)).toBe(false);
  });

  it("falls back to the request URL when Fastify route metadata is unavailable", () => {
    expect(isPublicRequestRoute(undefined, "/system/releases/record")).toBe(true);
    expect(isPublicRequestRoute(undefined, "/system/releases/record?retry=true")).toBe(true);
    expect(isPublicRequestRoute(undefined, "/members")).toBe(false);
  });
});
