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
import { getActorBySub, isAdminRole } from "./actor";

const mockIdentityFindUnique = prisma.authIdentity.findUnique as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;

describe("isAdminRole", () => {
  it("allows admin and owner roles to use admin capabilities", () => {
    expect(isAdminRole("MEMBER")).toBe(false);
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("OWNER")).toBe(true);
  });
});

describe("getActorBySub", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("looks up actors by linked Auth0 identity with the expected select shape", async () => {
    mockIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        displayName: "Member User",
        role: "MEMBER",
        houseId: "house-1",
        organizationId: "org-1",
        organization: {
          slug: "acme",
        },
      },
    });

    await expect(getActorBySub("github|member")).resolves.toEqual({
      id: "user-1",
      auth0Sub: "github|member",
      displayName: "Member User",
      role: "MEMBER",
      houseId: "house-1",
      organizationId: "org-1",
      organizationSlug: "acme",
    });

    expect(mockIdentityFindUnique).toHaveBeenCalledWith({
      where: { providerSubject: "github|member" },
      select: {
        user: {
          select: {
            id: true,
            displayName: true,
            role: true,
            houseId: true,
            organizationId: true,
            organization: {
              select: {
                slug: true,
              },
            },
          },
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
        slug: "acme",
      },
    });

    await expect(getActorBySub("auth0|member")).resolves.toEqual({
      id: "user-1",
      auth0Sub: "auth0|member",
      displayName: "Member User",
      role: "MEMBER",
      houseId: "house-1",
      organizationId: "org-1",
      organizationSlug: "acme",
    });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { auth0Sub: "auth0|member" },
      select: {
        id: true,
        displayName: true,
        role: true,
        houseId: true,
        organizationId: true,
        organization: {
          select: {
            slug: true,
          },
        },
      },
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
      },
    });

    await expect(getActorBySub("auth0|member")).resolves.toBeNull();
  });
});
