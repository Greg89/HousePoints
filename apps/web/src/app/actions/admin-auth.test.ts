import { beforeEach, describe, expect, it, vi } from "vitest";
import { readActiveOrganizationSlug } from "@/lib/active-organization";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { logWarn } from "@/lib/logging";
import { getActorMappingForAdmin, resolveActiveActorMapping } from "./admin-auth";

vi.mock("@/lib/current-user", () => ({
  getCurrentUserForRequest: vi.fn(),
}));

vi.mock("@/lib/active-organization", () => ({
  readActiveOrganizationSlug: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  logWarn: vi.fn(),
}));

const readActiveOrganizationSlugMock = vi.mocked(readActiveOrganizationSlug);
const getCurrentUserForRequestMock = vi.mocked(getCurrentUserForRequest);
const logWarnMock = vi.mocked(logWarn);

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
  ],
  created: false,
};

describe("resolveActiveActorMapping", () => {
  it("prefers active membership role and org fields over legacy mapping fields", () => {
    expect(resolveActiveActorMapping(mapping)).toMatchObject({
      role: "ADMIN",
      organizationId: "org-1",
      organizationSlug: "acme",
      houseId: "house-1",
      houseName: "Slytherin",
      houseColor: "#22c55e",
    });
  });

  it("prefers the selected organization slug when multiple memberships exist", () => {
    expect(
      resolveActiveActorMapping(
        {
          ...mapping,
          organizationContexts: [
            mapping.organizationContexts[0],
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
        },
        "beta",
      ),
    ).toMatchObject({
      role: "OWNER",
      organizationId: "org-2",
      organizationSlug: "beta",
      houseId: null,
    });
  });
});

describe("getActorMappingForAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readActiveOrganizationSlugMock.mockResolvedValue(null);
  });

  it("authorizes admins from the active membership context", async () => {
    getCurrentUserForRequestMock.mockResolvedValue(mapping);

    await expect(getActorMappingForAdmin("createHouse", "request-1")).resolves.toMatchObject({
      id: "user-1",
      role: "ADMIN",
      organizationId: "org-1",
    });

    expect(logWarnMock).not.toHaveBeenCalled();
  });

  it("rejects users without an admin or owner active membership role", async () => {
    getCurrentUserForRequestMock.mockResolvedValue({
      ...mapping,
      organizationContexts: [
        {
          ...mapping.organizationContexts[0],
          role: "MEMBER",
        },
      ],
    });

    await expect(getActorMappingForAdmin("createHouse", "request-1")).rejects.toThrow("Admin role required");

    expect(logWarnMock).toHaveBeenCalledWith("web.admin.forbidden", {
      action: "createHouse",
      requestId: "request-1",
      actorUserId: "user-1",
      role: "MEMBER",
    });
  });
});
