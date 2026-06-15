import { describe, expect, it } from "vitest";
import { readBearerToken } from "./auth";

describe("readBearerToken", () => {
  it("reads a case-insensitive bearer token", () => {
    expect(readBearerToken("bearer token-value")).toBe("token-value");
  });

  it("rejects missing and non-bearer authorization values", () => {
    expect(readBearerToken(undefined)).toBeNull();
    expect(readBearerToken("Basic credentials")).toBeNull();
    expect(readBearerToken("Bearer   ")).toBeNull();
  });
});
