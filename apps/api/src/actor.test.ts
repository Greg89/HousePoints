import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@housepoints/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@housepoints/db";
import { getActorBySub, isAdminRole } from "./actor";

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

  it("looks up actors by Auth0 subject with the expected select shape", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      auth0Sub: "auth0|member",
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
      role: "MEMBER",
      houseId: "house-1",
      organizationId: "org-1",
      organizationSlug: "acme",
    });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { auth0Sub: "auth0|member" },
      select: {
        id: true,
        auth0Sub: true,
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
    mockFindUnique.mockResolvedValue(null);

    await expect(getActorBySub("auth0|missing")).resolves.toBeNull();
  });

  it("returns null when the user is not mapped to an organization", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      auth0Sub: "auth0|member",
      role: "MEMBER",
      houseId: null,
      organizationId: null,
      organization: null,
    });

    await expect(getActorBySub("auth0|member")).resolves.toBeNull();
  });
});
