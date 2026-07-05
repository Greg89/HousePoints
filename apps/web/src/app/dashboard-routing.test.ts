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

  it("prefers the resolved session organization when redirecting from the root route", () => {
    expect(
      getRootOrganizationRedirect("/", {
        isAuthenticated: true,
        organizationSlug: "beta org",
        organizationContexts: [
          {
            organizationId: "org-1",
            organizationName: "Acme Org",
            organizationSlug: "acme",
            role: "MEMBER",
            houseId: "house-1",
            houseName: "Living Room",
            houseColor: "#7c3aed",
            isCurrent: false,
          },
          {
            organizationId: "org-2",
            organizationName: "Beta Org",
            organizationSlug: "beta org",
            role: "ADMIN",
            houseId: "house-2",
            houseName: "Bedroom",
            houseColor: "#f97316",
            isCurrent: true,
          },
        ],
        needsOrg: false,
        needsHouseAssignment: false,
      }),
    ).toBe("/o/beta%20org");
  });

  it("falls back to the current active membership when the session organization is missing", () => {
    expect(
      getRootOrganizationRedirect("/", {
        isAuthenticated: true,
        organizationSlug: null,
        organizationContexts: [
          {
            organizationId: "org-1",
            organizationName: "Acme Org",
            organizationSlug: "acme",
            role: "MEMBER",
            houseId: "house-1",
            houseName: "Living Room",
            houseColor: "#7c3aed",
            isCurrent: false,
          },
          {
            organizationId: "org-2",
            organizationName: "Beta Org",
            organizationSlug: "beta org",
            role: "ADMIN",
            houseId: "house-2",
            houseName: "Bedroom",
            houseColor: "#f97316",
            isCurrent: true,
          },
        ],
        needsOrg: false,
        needsHouseAssignment: false,
      }),
    ).toBe("/o/beta%20org");
  });

  it("falls back to the first active membership before the legacy organization slug", () => {
    expect(
      getRootOrganizationRedirect("/", {
        isAuthenticated: true,
        organizationSlug: "legacy-org",
        organizationContexts: [
          {
            organizationId: "org-1",
            organizationName: "Acme Org",
            organizationSlug: "acme",
            role: "MEMBER",
            houseId: "house-1",
            houseName: "Living Room",
            houseColor: "#7c3aed",
            isCurrent: false,
          },
        ],
        needsOrg: false,
        needsHouseAssignment: false,
      }),
    ).toBe("/o/acme");
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
