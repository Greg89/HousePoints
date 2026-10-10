import { describe, expect, it } from "vitest";
import { dashboardSummarySchema } from "./dashboard-schemas.js";
import { selectOverviewReport } from "./overview-report.js";

const house = { id: "a", name: "Alpha" };
const standout = { memberId: "member-a", memberName: "Alice", houseId: "a", houseName: "Alpha", houseColor: "#123456", points: 10 };
const activity = { id: "tx", type: "AWARD", actorName: "Giver", targetUserName: "Alice", targetHouseName: "Alpha", targetHouseColor: "#123456", delta: 5, reason: "Helped", season: null, trait: "LEADERSHIP", createdAt: "2026-10-01T12:00:00.000Z" };
function fixture() {
  return dashboardSummarySchema.parse({
    generatedAt: "2026-10-01T12:00:00.000Z",
    selectedSeason: { id: "s", name: "Season", startsAt: "2026-01-01T00:00:00.000Z", endsAt: null, isActive: true },
    seasonWinnerSummary: null, seasonStartsAt: "2026-01-01T00:00:00.000Z", monthStartsAt: "2026-10-01T00:00:00.000Z",
    seasonStandout: { ...standout, houseId: "b", memberName: "Bob" },
    seasonStandoutsByHouse: [{ houseId: "a", standout }],
    monthlyStandout: null, monthlyStandoutsByHouse: [],
    traitLeaders: [{ houseId: "a", houseName: "Alpha", houseColor: "#123456", trait: "LEADERSHIP", count: 2 }],
    categoryLeaders: [{ houseId: "a", houseName: "Alpha", houseColor: "#123456", category: { id: "cat", name: "Community", legacyTrait: null, archivedAt: "2026-09-01T00:00:00.000Z" }, count: 3 }],
    recentActivity: [{ ...activity, id: "other", targetHouseName: "Beta" }, ...Array.from({ length: 10 }, (_, i) => ({ ...activity, id: String(i) }))],
    pointsVelocity: [
      { houseId: "a", houseName: "Alpha", houseColor: "#123456", days: [{ date: "2026-10-01", points: 5 }] },
      { houseId: "b", houseName: "Beta", houseColor: "#654321", days: [{ date: "2026-10-01", points: 100 }] },
    ],
    houseMemberRankings: [{ houseId: "a", members: [
      { memberId: "member-a", displayName: "Alice", role: "MEMBER", points: 10, rank: 1 },
      { memberId: "former", displayName: "Former member", role: null, points: 10, rank: 1 },
      { memberId: null, displayName: "Unavailable", role: null, points: -2, rank: 3 },
    ] }],
  });
}
describe("shared overview report", () => {
  it("scopes each widget to the house without recalculating server rankings", () => {
    const summary = fixture();
    const report = selectOverviewReport(summary, house);
    expect(report.standout?.memberName).toBe("Alice");
    expect(report.leaders.map(x => x.houseId)).toEqual(["a"]);
    expect(report.velocity.map(x => x.houseId)).toEqual(["a"]);
    expect(report.maxVelocityPoints).toBe(5);
    expect(report.rankedMembers).toEqual(summary.houseMemberRankings[0].members);
    expect(report.recentActivity).toHaveLength(8);
    expect(report.recentActivity.every(x => x.targetHouseName === "Alpha")).toBe(true);
    expect(summary.recentActivity).toHaveLength(11);
  });
  it("preserves category names, including archived categories, and legacy traits", () => {
    expect(selectOverviewReport(fixture(), house, true).leaders[0].name).toBe("Community");
    expect(selectOverviewReport(fixture(), house, false).leaders[0].name).toBe("Leadership");
  });
  it("keeps organization-wide behavior for web reports", () => {
    const report = selectOverviewReport(fixture());
    expect(report.standout?.memberName).toBe("Bob");
    expect(report.velocity).toHaveLength(2);
    expect(report.maxVelocityPoints).toBe(100);
    expect(report.recentActivity[0].id).toBe("other");
    expect(report.rankedMembers).toEqual([]);
  });
  it("returns empty widgets for an unknown house instead of other-house data", () => {
    const report = selectOverviewReport(fixture(), { id: "missing", name: "Missing" });
    expect(report).toMatchObject({ standout: null, leaders: [], velocity: [], rankedMembers: [], recentActivity: [], maxVelocityPoints: 1 });
  });
});
