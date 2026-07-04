import { describe, expect, it } from "vitest";
import { resolveActiveAppUserMapping, resolveActiveOrganizationContext } from "./active-user-context";

const mapping = {
  id: "user-1",
  auth0Sub: "auth0|user-1",
  email: "user@example.com",
  displayName: "User One",
  houseThemeEnabled: false,
  role: "MEMBER" as const,
  organizationId: null,
  organizationSlug: null,
  houseId: null,
  houseName: null,
  houseColor: null,
  organizationContexts: [
    {
      organizationId: "org-1",
      organizationName: "Acme Corp",
      organizationSlug: "acme",
      role: "ADMIN" as const,
      houseId: "house-1",
      houseName: "Slytherin",
      houseColor: "#22c55e",
      isCurrent: true,
    },
    {
      organizationId: "org-2",
      organizationName: "Beta Org",
      organizationSlug: "beta",
      role: "OWNER" as const,
      houseId: null,
      houseName: null,
      houseColor: null,
      isCurrent: false,
    },
  ],
  created: false,
};

describe("resolveActiveOrganizationContext", () => {
  it("prefers the selected organization slug", () => {
    expect(resolveActiveOrganizationContext(mapping, "beta")).toMatchObject({
      organizationId: "org-2",
      organizationSlug: "beta",
    });
  });

  it("falls back to the current context and then the first context", () => {
    expect(resolveActiveOrganizationContext(mapping)).toMatchObject({
      organizationId: "org-1",
      organizationSlug: "acme",
    });

    expect(resolveActiveOrganizationContext({
      organizationContexts: mapping.organizationContexts.map((context) => ({
        ...context,
        isCurrent: false,
      })),
    })).toMatchObject({
      organizationId: "org-1",
      organizationSlug: "acme",
    });
  });
});

describe("resolveActiveAppUserMapping", () => {
  it("applies active membership fields over compatibility aliases", () => {
    expect(resolveActiveAppUserMapping(mapping, "beta")).toMatchObject({
      role: "OWNER",
      organizationId: "org-2",
      organizationSlug: "beta",
      houseId: null,
      houseName: null,
      houseColor: null,
    });
  });

  it("keeps compatibility aliases when no membership context exists", () => {
    const mappingWithoutContexts = {
      ...mapping,
      role: "OWNER" as const,
      organizationId: "org-legacy",
      organizationSlug: "legacy",
      organizationContexts: [],
    };

    expect(resolveActiveAppUserMapping(mappingWithoutContexts)).toMatchObject({
      role: "OWNER",
      organizationId: "org-legacy",
      organizationSlug: "legacy",
    });
  });
});
