import { describe, expect, it } from "vitest";
import { isPublicRoute } from "./api-hooks";

describe("isPublicRoute", () => {
  it("keeps only the health check outside API authentication", () => {
    expect(isPublicRoute("/health")).toBe(true);
    expect(isPublicRoute("/members")).toBe(false);
    expect(isPublicRoute(undefined)).toBe(false);
  });
});
