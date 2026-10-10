import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ actor: vi.fn(), season: vi.fn(), read: vi.fn() }));
vi.mock("@housepoints/db", () => ({ prisma: {} }));
vi.mock("../route-helpers.js", async (original) => ({
  ...await original<typeof import("../route-helpers.js")>(),
  requireActor: mocks.actor, resolveSeasonOrReject: mocks.season,
}));
vi.mock("../member-performance.js", () => ({ readMemberPerformance: mocks.read }));
import { registerMemberPerformanceRoutes } from "./member-performance.js";
import { ReportReadError } from "../report-cursor.js";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({ id: "viewer", membershipId: "membership", organizationId: "org-a" });
  mocks.season.mockResolvedValue({ id: "s", name: "Season", startsAt: new Date("2026-01-01"), endsAt: null, isActive: true });
  mocks.read.mockResolvedValue({
    member: { id: "m", displayName: "Alex" },
    selectedSeason: { id: "s", name: "Season", startsAt: "2026-01-01T00:00:00.000Z", endsAt: null, isActive: true },
    summary: { netPoints: 0, awardedPoints: 0, deductedPoints: 0, transactionCount: 0, awardCount: 0, deductionCount: 0, deductionsOutsideCategory: null },
    recognition: [], days: [], recentActivity: [],
  });
});
async function request(payload: unknown) {
  const app = Fastify();
  await registerMemberPerformanceRoutes(app);
  try { return await app.inject({ method: "POST", url: "/members/performance", payload: payload as object }); }
  finally { await app.close(); }
}
describe("member performance route", () => {
  it("derives report authorization from the actor and resolves the selected season", async () => {
    const response = await request({ memberId: "m", seasonId: "s" });
    expect(response.statusCode).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-a", actorUserId: "viewer", membershipId: "membership", memberId: "m" }));
    expect(response.json().member.id).toBe("m");
  });
  it("rejects caller-supplied organization scope", async () => {
    const response = await request({ memberId: "m", organizationId: "other" });
    expect(response.statusCode).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("returns typed report-not-found errors", async () => {
    mocks.read.mockRejectedValue(new ReportReadError(404, "REPORT_SCOPE_NOT_FOUND", "Report person not found."));
    const response = await request({ memberId: "m" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "REPORT_SCOPE_NOT_FOUND", message: "Report person not found." });
  });
});
