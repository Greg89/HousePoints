import { describe, expect, it } from "vitest";
import { parseCorsAllowedOrigins } from "./config";

describe("parseCorsAllowedOrigins", () => {
  it("normalizes and deduplicates comma-separated HTTP origins", () => {
    expect(
      parseCorsAllowedOrigins(
        "http://localhost:3000/, https://app.example.com, http://localhost:3000",
      ),
    ).toEqual(["http://localhost:3000", "https://app.example.com"]);
  });

  it.each([
    undefined,
    "",
    "example.com",
    "ftp://example.com",
    "https://user:password@example.com",
    "https://example.com/path",
    "https://example.com?query=1",
    "https://example.com#fragment",
  ])("rejects invalid configuration value %j", (value) => {
    expect(() => parseCorsAllowedOrigins(value)).toThrow();
  });
});
