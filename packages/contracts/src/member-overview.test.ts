import { describe, expect, it } from "vitest";
import { memberPerformanceRequestSchema } from "./member-performance-schemas.js";
import { selectMemberOverview } from "./member-overview.js";
import type { DashboardSummary, LeaderboardEntry } from "./dashboard-schemas.js";

const houses: LeaderboardEntry[] = ["a", "b"].map(id => ({ id, name: id, color: "#123456", description: null, memberCount: 1, transactions: 1, score: 10 }));
const member = { memberId: "m", displayName: "Same name", role: "MEMBER" as const, points: 5, rank: 1, isCurrentMember: true, currentHouseId: "b" };
const summary: Pick<DashboardSummary, "houseMemberRankings"> = { houseMemberRankings: [
  { houseId: "a", members: [member] },
  { houseId: "b", members: [{ ...member, points: 10 }, { ...member, memberId: "other", points: 15 }] },
] };
describe("shared member overview", () => {
  it("combines transferred-member totals and preserves tied leaderboard ranks", () => {
    expect(selectMemberOverview(summary, houses, "m")).toEqual({
      rank: 1,
      contributions: [
        { houseId: "a", houseName: "a", houseColor: "#123456", points: 5 },
        { houseId: "b", houseName: "b", houseColor: "#123456", points: 10 },
      ],
    });
  });
  it("selects by member ID instead of display name", () => {
    expect(selectMemberOverview(summary, houses, "other").contributions).toHaveLength(1);
    expect(selectMemberOverview(summary, houses, "missing")).toEqual({ rank: null, contributions: [] });
  });
  it("rejects empty IDs and caller-supplied organization scopes", () => {
    expect(memberPerformanceRequestSchema.safeParse({ memberId: "" }).success).toBe(false);
    expect(memberPerformanceRequestSchema.safeParse({ memberId: "m", organizationId: "other" }).success).toBe(false);
    expect(memberPerformanceRequestSchema.parse({ memberId: "m" })).toEqual({ memberId: "m" });
  });
});
