import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@housepoints/db", () => ({
  prisma: {
    authIdentity: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@housepoints/db";
import {
  getActorBySub,
  getActorBySubForOrganizationSlug,
  getArchivedOwnerActorBySubAndSlug,
  getUserOrgContextBySub,
  getUserRouteOrgContextBySub,
  isAdminRole,
  isOwnerRole,
} from "./actor";

const mockIdentityFindUnique = prisma.authIdentity.findUnique as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const actorUserSelect = {
  id: true,
  displayName: true,
  memberships: {
    where: {
      isActive: true,
      archivedAt: null,
      organization: {
        archivedAt: null,
      },
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
      houseId: true,
      organization: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  },
};

const orgContextUserSelect = {
  memberships: {
    where: {
      isActive: true,
      archivedAt: null,
      organization: {
        archivedAt: null,
      },
    },
    select: {
      organizationId: true,
      organization: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  },
};

describe("isAdminRole", () => {
  it("allows admin and owner roles to use admin capabilities", () => {
    expect(isAdminRole("MEMBER")).toBe(false);
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("OWNER")).toBe(true);
  });
});

describe("isOwnerRole", () => {
  it("allows only owner roles to use owner-level capabilities", () => {
    expect(isOwnerRole("MEMBER")).toBe(false);
    expect(isOwnerRole("ADMIN")).toBe(false);
    expect(isOwnerRole("OWNER")).toBe(true);
  });
});

describe("getActorBySub", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("prefers active membership fields when resolving an actor by linked Auth0 identity", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "ADMIN",
            houseId: "membership-house",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
        ],
      },
    });

    await expect(getActorBySub("github|member")).resolves.toEqual({
      id: "user-1",
      auth0Sub: "github|member",
      displayName: "Member User",
      membershipId: "membership-1",
      role: "ADMIN",
      houseId: "membership-house",
      organizationId: "org-1",
      organizationName: "Acme Corp",
      organizationSlug: "acme",
    });

    expect(mockIdentityFindUnique).toHaveBeenCalledWith({
      where: { providerSubject: "github|member" },
      select: {
        user: {
          select: actorUserSelect,
        },
      },
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("falls back to the user auth0 subject while identities are backfilled", async () => {
    mockIdentityFindUnique.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      displayName: "Member User",
      memberships: [
        {
          id: "membership-1",
          organizationId: "org-1",
          role: "OWNER",
          houseId: "house-2",
          organization: {
            name: "Acme Corp",
            slug: "acme",
          },
        },
      ],
    });

    await expect(getActorBySub("auth0|member")).resolves.toEqual({
      id: "user-1",
      auth0Sub: "auth0|member",
      displayName: "Member User",
      membershipId: "membership-1",
      role: "OWNER",
      houseId: "house-2",
      organizationId: "org-1",
      organizationName: "Acme Corp",
      organizationSlug: "acme",
    });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { auth0Sub: "auth0|member" },
      select: actorUserSelect,
    });
  });

  it("returns null when no active membership exists", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        memberships: [],
      },
    });

    await expect(getActorBySub("auth0|member")).resolves.toBeNull();
  });

  it("uses the first active membership", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "ADMIN",
            houseId: "house-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
        ],
      },
    });

    await expect(getActorBySub("auth0|member")).resolves.toEqual({
      id: "user-1",
      auth0Sub: "auth0|member",
      displayName: "Member User",
      membershipId: "membership-1",
      role: "ADMIN",
      houseId: "house-1",
      organizationId: "org-1",
      organizationName: "Acme Corp",
      organizationSlug: "acme",
    });
  });

  it("uses the first active membership when only one membership exists", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "OWNER",
            houseId: "house-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
        ],
      },
    });

    await expect(getActorBySub("auth0|member")).resolves.toEqual({
      id: "user-1",
      auth0Sub: "auth0|member",
      displayName: "Member User",
      membershipId: "membership-1",
      role: "OWNER",
      houseId: "house-1",
      organizationId: "org-1",
      organizationName: "Acme Corp",
      organizationSlug: "acme",
    });
  });

  it("uses the preferred active membership when multiple memberships exist", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "ADMIN",
            houseId: "house-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
          {
            id: "membership-2",
            organizationId: "org-2",
            role: "OWNER",
            houseId: "house-2",
            organization: {
              name: "Beta Org",
              slug: "beta",
            },
          },
        ],
      },
    });

    await expect(getActorBySub("auth0|member")).resolves.toEqual({
      id: "user-1",
      auth0Sub: "auth0|member",
      displayName: "Member User",
      membershipId: "membership-1",
      role: "ADMIN",
      houseId: "house-1",
      organizationId: "org-1",
      organizationName: "Acme Corp",
      organizationSlug: "acme",
    });
  });

  it("returns null when no user matches the Auth0 subject", async () => {
    mockIdentityFindUnique.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue(null);

    await expect(getActorBySub("auth0|missing")).resolves.toBeNull();
  });

  it("returns null when the user is not mapped to an organization", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        memberships: [],
      },
    });

    await expect(getActorBySub("auth0|member")).resolves.toBeNull();
  });
});

describe("getActorBySubForOrganizationSlug", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the membership-scoped actor for the requested organization slug", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "OWNER",
            houseId: "house-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
          {
            id: "membership-2",
            organizationId: "org-2",
            role: "ADMIN",
            houseId: "house-2",
            organization: {
              name: "Beta Org",
              slug: "beta",
            },
          },
        ],
      },
    });

    await expect(getActorBySubForOrganizationSlug("auth0|member", "beta")).resolves.toEqual({
      id: "user-1",
      auth0Sub: "auth0|member",
      displayName: "Member User",
      membershipId: "membership-2",
      role: "ADMIN",
      houseId: "house-2",
      organizationId: "org-2",
      organizationName: "Beta Org",
      organizationSlug: "beta",
    });
  });

  it("returns null when the requested slug is not one of the user's active memberships", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        memberships: [
          {
            id: "membership-1",
            organizationId: "org-1",
            role: "OWNER",
            houseId: "house-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
        ],
      },
    });

    await expect(getActorBySubForOrganizationSlug("auth0|member", "beta")).resolves.toBeNull();
  });

  it("does not resolve scoped API calls without a matching membership", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        memberships: [],
      },
    });

    await expect(
      getActorBySubForOrganizationSlug("auth0|member", "legacy-acme"),
    ).resolves.toBeNull();
  });

  it("returns null when no user matches the subject for a scoped API call", async () => {
    mockIdentityFindUnique.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue(null);

    await expect(
      getActorBySubForOrganizationSlug("auth0|missing", "acme"),
    ).resolves.toBeNull();

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { auth0Sub: "auth0|missing" },
      select: actorUserSelect,
    });
  });
});

describe("getUserOrgContextBySub", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the active membership context", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [
          {
            organizationId: "org-1",
            role: "MEMBER",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
        ],
      },
    });

    await expect(getUserOrgContextBySub("auth0|member")).resolves.toEqual({
      organizationId: "org-1",
      organizationName: "Acme Corp",
      organizationSlug: "acme",
    });

    expect(mockIdentityFindUnique).toHaveBeenCalledWith({
      where: { providerSubject: "auth0|member" },
      select: { user: { select: orgContextUserSelect } },
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("uses the first active membership", async () => {
    mockIdentityFindUnique.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue({
      memberships: [
        {
          organizationId: "org-1",
          organization: {
            name: "Acme Corp",
            slug: "acme",
          },
        },
        {
          organizationId: "org-2",
          organization: {
            name: "Current Org",
            slug: "current-org",
          },
        },
      ],
    });

    await expect(getUserOrgContextBySub("auth0|member")).resolves.toEqual({
      organizationId: "org-1",
      organizationName: "Acme Corp",
      organizationSlug: "acme",
    });
  });

  it("returns empty org fields when no active membership exists", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [],
      },
    });

    await expect(getUserOrgContextBySub("auth0|member")).resolves.toEqual({
      organizationId: null,
      organizationName: null,
      organizationSlug: null,
    });
  });
});

describe("getUserRouteOrgContextBySub", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns requested membership plus an active fallback organization", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [
          {
            organizationId: "org-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
          {
            organizationId: "org-2",
            role: "MEMBER",
            organization: {
              name: "Second Org",
              slug: "second-org",
            },
          },
        ],
      },
    });

    await expect(getUserRouteOrgContextBySub("auth0|member", "org-2")).resolves.toEqual({
      organizationId: "org-1",
      organizationName: "Acme Corp",
      organizationSlug: "acme",
      requestedMembership: {
        organizationId: "org-2",
        organizationName: "Second Org",
        organizationSlug: "second-org",
        organizationArchivedAt: null,
        role: "MEMBER",
      },
    });
  });

  it("returns archived requested membership without selecting it as the active fallback organization", async () => {
    const archivedAt = new Date("2026-07-04T17:30:00.000Z");
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [
          {
            organizationId: "org-1",
            role: "MEMBER",
            organization: {
              name: "Archived Org",
              slug: "archived-org",
              archivedAt,
            },
          },
          {
            organizationId: "org-2",
            role: "MEMBER",
            organization: {
              name: "Active Org",
              slug: "active-org",
              archivedAt: null,
            },
          },
        ],
      },
    });

    await expect(getUserRouteOrgContextBySub("auth0|member", "org-1")).resolves.toEqual({
      organizationId: "org-2",
      organizationName: "Active Org",
      organizationSlug: "active-org",
      requestedMembership: {
        organizationId: "org-1",
        organizationName: "Archived Org",
        organizationSlug: "archived-org",
        organizationArchivedAt: archivedAt,
        role: "MEMBER",
      },
    });
  });
});

describe("getArchivedOwnerActorBySubAndSlug", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns an owner membership for the requested archived organization", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-owner",
        displayName: "Olivia",
        memberships: [{
          id: "membership-owner",
          organizationId: "org-1",
          role: "OWNER",
          houseId: "house-1",
          organization: { name: "Acme Corp", slug: "acme" },
        }],
      },
    });

    await expect(
      getArchivedOwnerActorBySubAndSlug("auth0|owner", "acme"),
    ).resolves.toEqual({
      id: "user-owner",
      auth0Sub: "auth0|owner",
      displayName: "Olivia",
      membershipId: "membership-owner",
      role: "OWNER",
      houseId: "house-1",
      organizationId: "org-1",
      organizationName: "Acme Corp",
      organizationSlug: "acme",
    });
  });

  it("does not authorize users without a matching archived owner membership", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-member",
        displayName: "Alice",
        memberships: [],
      },
    });

    await expect(
      getArchivedOwnerActorBySubAndSlug("auth0|member", "acme"),
    ).resolves.toBeNull();
  });
});
