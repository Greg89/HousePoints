import { describe, expect, it } from "vitest";
import { getRootOrganizationRedirect } from "./dashboard-routing";

describe("getRootOrganizationRedirect", () => {
  it("redirects authenticated assigned users from the root route to their scoped organization", () => {
    expect(
      getRootOrganizationRedirect("/", {
        isAuthenticated: true,
        organizationSlug: "acme corp",
        needsOrg: false,
        needsHouseAssignment: false,
      }),
    ).toBe("/o/acme%20corp");
  });

  it("does not redirect scoped organization routes", () => {
    expect(
      getRootOrganizationRedirect("/o/acme", {
        isAuthenticated: true,
        organizationSlug: "acme",
        needsOrg: false,
        needsHouseAssignment: false,
      }),
    ).toBeNull();
  });

  it("keeps root onboarding states renderable", () => {
    expect(
      getRootOrganizationRedirect("/", {
        isAuthenticated: true,
        organizationSlug: null,
        needsOrg: true,
        needsHouseAssignment: false,
      }),
    ).toBeNull();

    expect(
      getRootOrganizationRedirect("/", {
        isAuthenticated: true,
        organizationSlug: "acme",
        needsOrg: false,
        needsHouseAssignment: true,
      }),
    ).toBeNull();
  });
});
