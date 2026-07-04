import { describe, expect, it } from "vitest";
import { APP_USER_SELECT, mapAppUser } from "./app-user";

describe("mapAppUser", () => {
  it("does not select legacy user-level organization, role, or house shadows", () => {
    expect(APP_USER_SELECT).not.toEqual(expect.objectContaining({
      organizationId: expect.anything(),
      role: expect.anything(),
      houseId: expect.anything(),
      organization: expect.anything(),
      house: expect.anything(),
    }));
    expect(APP_USER_SELECT.memberships.select).toEqual(expect.objectContaining({
      organizationId: true,
      role: true,
      houseId: true,
    }));
  });

  it("maps organization and house summaries for an assigned user", () => {
    expect(
      mapAppUser({
        id: "user-1",
        auth0Sub: "auth0|user-1",
        email: "alice@example.com",
        displayName: "Alice",
        houseThemeEnabled: true,
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

  it("marks the first active membership current", () => {
    expect(
      mapAppUser({
        id: "user-1",
        auth0Sub: "auth0|user-1",
        email: "alice@example.com",
        displayName: "Alice",
        houseThemeEnabled: false,
        memberships: [
          {
            organizationId: "org-1",
            role: "ADMIN",
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
      role: "ADMIN",
      organizationId: "org-1",
      organizationSlug: "acme",
      houseId: "house-1",
      houseName: "Phoenix",
      houseColor: "#7c3aed",
      organizationContexts: [
        expect.objectContaining({ organizationId: "org-1", isCurrent: true }),
        expect.objectContaining({ organizationId: "org-2", isCurrent: false }),
      ],
    }));
  });

  it("ignores stale legacy-like data when active memberships exist", () => {
    expect(
      mapAppUser({
        id: "user-1",
        auth0Sub: "auth0|user-1",
        email: "alice@example.com",
        displayName: "Alice",
        houseThemeEnabled: false,
        role: "MEMBER",
        houseId: null,
        organizationId: "org-stale",
        organization: null,
        house: null,
        memberships: [
          {
            organizationId: "org-1",
            role: "ADMIN",
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
      role: "ADMIN",
      organizationId: "org-1",
      organizationSlug: "acme",
      houseId: "house-1",
      houseName: "Phoenix",
      houseColor: "#7c3aed",
      organizationContexts: [
        expect.objectContaining({ organizationId: "org-1", isCurrent: true }),
        expect.objectContaining({ organizationId: "org-2", isCurrent: false }),
      ],
    }));
  });

  it("does not add stale legacy-like organization context when active memberships exist", () => {
    expect(
      mapAppUser({
        id: "user-1",
        auth0Sub: "auth0|user-1",
        email: "alice@example.com",
        displayName: "Alice",
        houseThemeEnabled: false,
        role: "OWNER",
        houseId: "legacy-house",
        organizationId: "org-stale",
        organization: { name: "Stale Org", slug: "stale" },
        house: { name: "Legacy House", color: "#111111" },
        memberships: [
          {
            organizationId: "org-1",
            role: "ADMIN",
            houseId: null,
            organization: { name: "Acme Corp", slug: "acme" },
            house: null,
          },
        ],
      }),
    ).toEqual(expect.objectContaining({
      role: "ADMIN",
      organizationId: "org-1",
      organizationSlug: "acme",
      houseId: null,
      houseName: null,
      houseColor: null,
      organizationContexts: [
        {
          organizationId: "org-1",
          organizationName: "Acme Corp",
          organizationSlug: "acme",
          role: "ADMIN",
          houseId: null,
          houseName: null,
          houseColor: null,
          isCurrent: true,
        },
      ],
    }));
  });

  it("ignores legacy organization fields when no active memberships exist", () => {
    expect(
      mapAppUser({
        id: "user-1",
        auth0Sub: "auth0|user-1",
        email: "alice@example.com",
        displayName: "Alice",
        houseThemeEnabled: false,
        memberships: [],
      }),
    ).toEqual(expect.objectContaining({
      role: "MEMBER",
      organizationId: null,
      organizationSlug: null,
      houseId: null,
      houseName: null,
      houseColor: null,
      organizationContexts: [],
    }));
  });
});
