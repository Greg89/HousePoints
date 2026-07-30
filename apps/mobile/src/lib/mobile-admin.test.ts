import { describe, expect, it } from "vitest";

import { buildWebAdminUrl, canAccessMobileAdmin } from "./mobile-admin";

describe("canAccessMobileAdmin", () => {
  it.each(["ADMIN", "OWNER"] as const)("allows %s when the rollout flag is enabled", (role) => {
    expect(canAccessMobileAdmin(true, role)).toBe(true);
  });

  it("denies members and missing roles", () => {
    expect(canAccessMobileAdmin(true, "MEMBER")).toBe(false);
    expect(canAccessMobileAdmin(true, null)).toBe(false);
  });

  it("denies every role while the rollout flag is disabled", () => {
    expect(canAccessMobileAdmin(false, "OWNER")).toBe(false);
    expect(canAccessMobileAdmin(false, "ADMIN")).toBe(false);
  });
});

describe("buildWebAdminUrl", () => {
  it("normalizes the base URL and scopes Manage to the active organization", () => {
    expect(buildWebAdminUrl("https://app.example.com/", "acme"))
      .toBe("https://app.example.com/o/acme?tab=manage");
  });
});

