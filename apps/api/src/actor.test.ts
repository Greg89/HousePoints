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
  role: true,
  houseId: true,
  organizationId: true,
  organization: {
    select: {
      name: true,
      slug: true,
    },
  },
  memberships: {
    where: {
      isActive: true,
      archivedAt: null,
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
  organizationId: true,
  organization: {
    select: {
      name: true,
      slug: true,
    },
  },
  memberships: {
    where: {
      isActive: true,
      archivedAt: null,
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
        role: "MEMBER",
        houseId: "legacy-house",
        organizationId: "org-1",
        organization: {
          name: "Legacy Acme",
          slug: "legacy-acme",
        },
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

  it("falls back to the legacy user subject while identities are backfilled", async () => {
    mockIdentityFindUnique.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      displayName: "Member User",
      role: "MEMBER",
      houseId: "house-1",
      organizationId: "org-1",
      organization: {
        name: "Acme Corp",
        slug: "acme",
      },
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

  it("falls back to legacy user org fields when no active membership exists yet", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        role: "MEMBER",
        houseId: "house-1",
        organizationId: "org-1",
        organization: {
          name: "Acme Corp",
          slug: "acme",
        },
        memberships: [],
      },
    });

    await expect(getActorBySub("auth0|member")).resolves.toEqual({
      id: "user-1",
      auth0Sub: "auth0|member",
      displayName: "Member User",
      membershipId: null,
      role: "MEMBER",
      houseId: "house-1",
      organizationId: "org-1",
      organizationName: "Acme Corp",
      organizationSlug: "acme",
    });
  });

  it("uses the first active membership when the legacy organization shadow is empty", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        role: "MEMBER",
        houseId: null,
        organizationId: null,
        organization: null,
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

  it("uses the first active membership when the legacy organization shadow is stale", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        role: "MEMBER",
        houseId: null,
        organizationId: "org-stale",
        organization: null,
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
        role: "MEMBER",
        houseId: null,
        organizationId: null,
        organization: null,
        memberships: [],
      },
    });

    await expect(getActorBySub("auth0|member")).resolves.toBeNull();
  });
});

describe("getUserOrgContextBySub", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the active membership context when the legacy current organization shadow is empty", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        organizationId: null,
        organization: null,
        memberships: [
          {
            organizationId: "org-1",
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

  it("keeps the legacy current organization when it matches an active membership", async () => {
    mockIdentityFindUnique.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue({
      organizationId: "org-2",
      organization: {
        name: "Legacy Org",
        slug: "legacy-org",
      },
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
      organizationId: "org-2",
      organizationName: "Current Org",
      organizationSlug: "current-org",
    });
  });

  it("falls back to legacy organization fields when no active membership exists", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        organizationId: "org-legacy",
        organization: {
          name: "Legacy Org",
          slug: "legacy-org",
        },
        memberships: [],
      },
    });

    await expect(getUserOrgContextBySub("auth0|member")).resolves.toEqual({
      organizationId: "org-legacy",
      organizationName: "Legacy Org",
      organizationSlug: "legacy-org",
    });
  });
});

describe("getUserRouteOrgContextBySub", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns requested membership plus an active fallback organization when the legacy shadow is empty", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        organizationId: null,
        organization: null,
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
      },
    });
  });
});
