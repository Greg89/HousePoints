import { describe, expect, it } from "vitest";
import { parseBooleanFlag, parseCorsAllowedOrigins, parseReleaseAutomationSecret } from "./config";

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

describe("parseBooleanFlag", () => {
  it("only enables flags when the value is true", () => {
    expect(parseBooleanFlag("true")).toBe(true);
    expect(parseBooleanFlag(" TRUE ")).toBe(true);
    expect(parseBooleanFlag("false")).toBe(false);
    expect(parseBooleanFlag("1")).toBe(false);
    expect(parseBooleanFlag(undefined)).toBe(false);
  });
});

describe("parseReleaseAutomationSecret", () => {
  it("trims a configured release automation secret", () => {
    expect(parseReleaseAutomationSecret("  release-secret-123  ")).toBe("release-secret-123");
  });

  it.each([undefined, "", "short-secret"])("rejects invalid release automation secret %j", (value) => {
    expect(() => parseReleaseAutomationSecret(value)).toThrow();
  });
});
