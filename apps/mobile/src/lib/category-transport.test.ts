import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, callApi } from "./api-client";
import { CATEGORY_READ_CAPABILITY } from "./recognition-categories";

vi.mock("./env", () => ({ env: { apiBaseUrl: "https://api.example.test" } }));
vi.mock("./logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, serializeError: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

const category = { id: "category-old", name: "Community Impact", legacyTrait: null, archivedAt: "2026-09-21T12:00:00.000Z" };
const activity = {
  id: "point-1", type: "AWARD", actorName: "Alice", targetUserName: "Bob",
  targetHouseName: "Phoenix", targetHouseColor: "#7c3aed", delta: 10,
  reason: "Great work", trait: null, category, createdAt: "2026-09-20T12:00:00.000Z",
  season: { id: "season-1", name: "Q3", isActive: true },
};

describe("category-capable mobile reads", () => {
  it("keeps the server's upgrade-required response typed for an older request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "RECOGNITION_CATEGORY_CLIENT_UPGRADE_REQUIRED", message: "Update HousePoints to view custom recognition activity." }, { status: 426 })));
    await expect(callApi("/transactions/recent", { limit: 20 }, { organizationSlug: "org" })).rejects.toMatchObject({
      statusCode: 426,
      code: "RECOGNITION_CATEGORY_CLIENT_UPGRADE_REQUIRED",
      message: "Update HousePoints to view custom recognition activity.",
    } satisfies Partial<ApiResponseError>);
  });
  it("parses archived custom activity and sends the capability on paged reads", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [activity], nextCursor: null }));
    vi.stubGlobal("fetch", fetcher);
    const page = await callApi("/transactions/recent", { ...CATEGORY_READ_CAPABILITY, limit: 20 }, { organizationSlug: "org" });
    expect(page.items[0].category?.name).toBe("Community Impact");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ categoryApiVersion: "categories-v1", limit: 20 });
  });

  it("parses category leaders and fixed names in the dashboard summary", async () => {
    const summary = {
      generatedAt: "2026-09-21T12:00:00.000Z",
      selectedSeason: { id: "season-1", name: "Q3", startsAt: "2026-09-01T00:00:00.000Z", endsAt: null, isActive: true },
      seasonWinnerSummary: null,
      seasonStartsAt: "2026-09-01T00:00:00.000Z",
      seasonStandout: null,
      seasonStandoutsByHouse: [],
      monthStartsAt: "2026-09-01T00:00:00.000Z",
      monthlyStandout: null,
      monthlyStandoutsByHouse: [],
      traitLeaders: [],
      categoryLeaders: [{ houseId: "house-1", houseName: "Phoenix", houseColor: "#7c3aed", category, count: 1 }],
      recentActivity: [activity],
      pointsVelocity: [],
      houseMemberRankings: [],
    };
    const fetcher = vi.fn().mockResolvedValue(Response.json(summary));
    vi.stubGlobal("fetch", fetcher);
    const result = await callApi("/dashboard/summary", CATEGORY_READ_CAPABILITY, { organizationSlug: "org" });
    expect(result.categoryLeaders[0].category?.name).toBe("Community Impact");
    expect(result.recentActivity[0].category?.archivedAt).toBe(category.archivedAt);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(CATEGORY_READ_CAPABILITY);
  });
});
