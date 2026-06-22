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
        organization: { slug: "acme" },
        house: { name: "Phoenix", color: "#7c3aed" },
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
    });
  });
});
