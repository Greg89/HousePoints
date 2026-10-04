import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("recognition category web flag", () => {
  it.each(["true", "false", "", "1", "TRUE"])("enables all organizations only for flag value '%s'", async (value) => {
    vi.stubEnv("RECOGNITION_CATEGORIES_WEB_ENABLED", value);
    const { recognitionCategoriesWebEnabled } = await import("./recognition-gate");
    expect(recognitionCategoriesWebEnabled).toBe(value === "true");
  });
});
