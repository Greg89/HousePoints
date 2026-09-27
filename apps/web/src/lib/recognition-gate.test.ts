import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("recognition category web cohort", () => {
  it("requires both the write flag and an allowed organization ID", async () => {
    vi.stubEnv("RECOGNITION_CATEGORIES_WEB_ENABLED", "true");
    vi.stubEnv("RECOGNITION_CATEGORY_ROLLOUT_ORGANIZATION_IDS", "org-1, org-2");
    const { recognitionCategoriesWebEnabledForOrganization } = await import("./recognition-gate");
    expect(recognitionCategoriesWebEnabledForOrganization("org-1")).toBe(true);
    expect(recognitionCategoriesWebEnabledForOrganization("org-3")).toBe(false);
    expect(recognitionCategoriesWebEnabledForOrganization(null)).toBe(false);
  });

  it("fails closed when the write flag or cohort is absent", async () => {
    vi.stubEnv("RECOGNITION_CATEGORIES_WEB_ENABLED", "false");
    vi.stubEnv("RECOGNITION_CATEGORY_ROLLOUT_ORGANIZATION_IDS", "org-1");
    const disabled = await import("./recognition-gate");
    expect(disabled.recognitionCategoriesWebEnabledForOrganization("org-1")).toBe(false);

    vi.resetModules();
    vi.stubEnv("RECOGNITION_CATEGORIES_WEB_ENABLED", "true");
    vi.stubEnv("RECOGNITION_CATEGORY_ROLLOUT_ORGANIZATION_IDS", "");
    const noCohort = await import("./recognition-gate");
    expect(noCohort.recognitionCategoriesWebEnabledForOrganization("org-1")).toBe(false);
  });
});
