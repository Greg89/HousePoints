import { describe, expect, it } from "vitest";
import { mapAppUser } from "./app-user";

describe("mapAppUser", () => {
  it("maps organization and house summaries for an assigned user", () => {
    expect(
      mapAppUser({
        id: "user-1",
        auth0Sub: "auth0|user-1",
        email: "alice@example.com",
        displayName: "Alice",
        houseThemeEnabled: true,
        role: "OWNER",
        houseId: "house-1",
        organizationId: "org-1",
        organization: { name: "Acme Corp", slug: "acme" },
        house: { name: "Phoenix", color: "#7c3aed" },
        memberships: [
          {
            organizationId: "org-1",
            role: "OWNER",
            houseId: "house-1",
            organization: { name: "Acme Corp", slug: "acme" },
            house: { name: "Phoenix", color: "#7c3aed" },
          },
        ],
      }),
    ).toEqual({
      id: "user-1",
      auth0Sub: "auth0|user-1",
      email: "alice@example.com",
      displayName: "Alice",
      houseThemeEnabled: true,
      role: "OWNER",
      organizationId: "org-1",
      organizationSlug: "acme",
      houseId: "house-1",
      houseName: "Phoenix",
      houseColor: "#7c3aed",
      organizationContexts: [
        {
          organizationId: "org-1",
          organizationName: "Acme Corp",
          organizationSlug: "acme",
          role: "OWNER",
          houseId: "house-1",
          houseName: "Phoenix",
          houseColor: "#7c3aed",
          isCurrent: true,
        },
      ],
    });
  });

  it("keeps organization and house summaries nullable during onboarding", () => {
    expect(
      mapAppUser({
        id: "user-1",
        auth0Sub: "auth0|user-1",
        email: null,
        displayName: "Alice",
        houseThemeEnabled: false,
        role: "MEMBER",
        houseId: null,
        organizationId: null,
        organization: null,
        house: null,
        memberships: [],
      }),
    ).toEqual({
      id: "user-1",
      auth0Sub: "auth0|user-1",
      email: null,
      displayName: "Alice",
      houseThemeEnabled: false,
      role: "MEMBER",
      organizationId: null,
      organizationSlug: null,
      houseId: null,
      houseName: null,
      houseColor: null,
      organizationContexts: [],
    });
  });

  it("maps all active organization contexts for future org switching", () => {
    expect(
      mapAppUser({
        id: "user-1",
        auth0Sub: "auth0|user-1",
        email: "alice@example.com",
        displayName: "Alice",
        houseThemeEnabled: false,
        role: "OWNER",
        houseId: "house-1",
        organizationId: "org-1",
        organization: { name: "Acme Corp", slug: "acme" },
        house: { name: "Phoenix", color: "#7c3aed" },
        memberships: [
          {
            organizationId: "org-1",
            role: "OWNER",
            houseId: "house-1",
            organization: { name: "Acme Corp", slug: "acme" },
            house: { name: "Phoenix", color: "#7c3aed" },
          },
          {
            organizationId: "org-2",
            role: "MEMBER",
            houseId: null,
            organization: { name: "Beta Org", slug: "beta" },
            house: null,
          },
        ],
      }),
    ).toEqual(expect.objectContaining({
      organizationContexts: [
        {
          organizationId: "org-1",
          organizationName: "Acme Corp",
          organizationSlug: "acme",
          role: "OWNER",
          houseId: "house-1",
          houseName: "Phoenix",
          houseColor: "#7c3aed",
          isCurrent: true,
        },
        {
          organizationId: "org-2",
          organizationName: "Beta Org",
          organizationSlug: "beta",
          role: "MEMBER",
          houseId: null,
          houseName: null,
          houseColor: null,
          isCurrent: false,
        },
      ],
    }));
  });

  it("adds the current legacy organization context when memberships are not selected yet", () => {
    expect(
      mapAppUser({
        id: "user-1",
        auth0Sub: "auth0|user-1",
        email: "alice@example.com",
        displayName: "Alice",
        houseThemeEnabled: false,
        role: "OWNER",
        houseId: "house-1",
        organizationId: "org-1",
        organization: { name: "Acme Corp", slug: "acme" },
        house: { name: "Phoenix", color: "#7c3aed" },
        memberships: [],
      }),
    ).toEqual(expect.objectContaining({
      organizationContexts: [
        {
          organizationId: "org-1",
          organizationName: "Acme Corp",
          organizationSlug: "acme",
          role: "OWNER",
          houseId: "house-1",
          houseName: "Phoenix",
          houseColor: "#7c3aed",
          isCurrent: true,
        },
      ],
    }));
  });
});
