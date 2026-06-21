import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@housepoints/db", () => ({
  prisma: {
    season: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@housepoints/db";
import type { ActorRecord } from "./actor";
import { mapSeason, resolveSeasonScope, SeasonScopeError } from "./season-scope";

const mockSeasonFindFirst = prisma.season.findFirst as ReturnType<typeof vi.fn>;

const actor: ActorRecord = {
  id: "user-1",
  auth0Sub: "auth0|user-1",
  role: "MEMBER",
  houseId: "house-1",
  organizationId: "org-1",
  organizationSlug: "acme",
};

const activeSeason = {
  id: "season-active",
  name: "Season 1",
  startsAt: new Date("2026-06-01T00:00:00.000Z"),
  endsAt: null,
  isActive: true,
};

describe("mapSeason", () => {
  it("serializes season dates for API responses", () => {
    expect(
      mapSeason({
        ...activeSeason,
        endsAt: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ).toEqual({
      id: "season-active",
      name: "Season 1",
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-07-01T00:00:00.000Z",
      isActive: true,
    });
  });

  it("keeps open-ended active seasons nullable", () => {
    expect(mapSeason(activeSeason).endsAt).toBeNull();
  });
});

describe("resolveSeasonScope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("scopes explicit season lookups to the actor organization", async () => {
    mockSeasonFindFirst.mockResolvedValue(activeSeason);

    await expect(resolveSeasonScope(actor, "season-active")).resolves.toBe(
      activeSeason,
    );

    expect(mockSeasonFindFirst).toHaveBeenCalledWith({
      where: {
        id: "season-active",
        organizationId: "org-1",
      },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        isActive: true,
      },
    });
  });

  it("rejects explicit seasons outside the actor organization", async () => {
    mockSeasonFindFirst.mockResolvedValue(null);

    await expect(resolveSeasonScope(actor, "season-other")).rejects.toMatchObject({
      statusCode: 404,
      code: "SEASON_NOT_FOUND",
      message: "Season not found",
    });
  });

  it("loads the active season for the actor organization by default", async () => {
    mockSeasonFindFirst.mockResolvedValue(activeSeason);

    await expect(resolveSeasonScope(actor)).resolves.toBe(activeSeason);

    expect(mockSeasonFindFirst).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        isActive: true,
      },
    });
  });

  it("returns a stable error when no active season exists", async () => {
    mockSeasonFindFirst.mockResolvedValue(null);

    const error = await resolveSeasonScope(actor).catch((caught) => caught);

    expect(error).toBeInstanceOf(SeasonScopeError);
    expect(error).toMatchObject({
      statusCode: 409,
      code: "ACTIVE_SEASON_REQUIRED",
      message: "An active season is required",
    });
  });
});
