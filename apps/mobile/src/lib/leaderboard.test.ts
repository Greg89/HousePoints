import type { DashboardSummary, LeaderboardEntry } from "@housepoints/contracts";
import { describe, expect, it } from "vitest";

import { contributorInitials, topContributors } from "./leaderboard";

const houses: LeaderboardEntry[] = [
  { id: "red", name: "Phoenix", color: "#dc2626", description: null, score: 50, transactions: 5, memberCount: 7 },
  { id: "blue", name: "Dragon", color: "#2563eb", description: null, score: 40, transactions: 4, memberCount: 7 },
];

const rankings: DashboardSummary["houseMemberRankings"] = [
  {
    houseId: "red",
    members: Array.from({ length: 7 }, (_, index) => ({
      memberId: `red-${index}`,
      displayName: `Red ${index}`,
      role: "MEMBER" as const,
      points: 20 - index * 2,
    })),
  },
  {
    houseId: "blue",
    members: Array.from({ length: 7 }, (_, index) => ({
      memberId: `blue-${index}`,
      displayName: `Blue ${index}`,
      role: "MEMBER" as const,
      points: 19 - index * 2,
    })),
  },
];

describe("topContributors", () => {
  it("returns the top ten positive scores across all houses", () => {
    const contributors = topContributors(rankings, houses);

    expect(contributors).toHaveLength(10);
    expect(contributors.map((member) => member.points)).toEqual([
      20, 19, 18, 17, 16, 15, 14, 13, 12, 11,
    ]);
    expect(new Set(contributors.map((member) => member.houseName))).toEqual(
      new Set(["Phoenix", "Dragon"]),
    );
    expect(contributors.map((member) => member.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("excludes zero, negative, and unknown-house members", () => {
    const result = topContributors(
      [
        { houseId: "red", members: [
          { memberId: "positive", displayName: "Positive", role: "MEMBER", points: 1 },
          { memberId: "zero", displayName: "Zero", role: "MEMBER", points: 0 },
          { memberId: "negative", displayName: "Negative", role: "MEMBER", points: -1 },
        ] },
        { houseId: "missing", members: [
          { memberId: "unknown", displayName: "Unknown", role: "MEMBER", points: 99 },
        ] },
      ],
      houses,
    );

    expect(result.map((member) => member.memberId)).toEqual(["positive"]);
  });

  it("combines a current member's points across houses and shares tied ranks", () => {
    const result = topContributors([
      { houseId: "red", members: [
        { memberId: "moved", displayName: "Alex", role: "MEMBER", points: 8, isCurrentMember: true, currentHouseId: "blue" },
        { memberId: "former", displayName: "Former", role: null, points: 30, isCurrentMember: false },
      ] },
      { houseId: "blue", members: [
        { memberId: "moved", displayName: "Alex", role: "MEMBER", points: -3, isCurrentMember: true, currentHouseId: "blue" },
        { memberId: "current", displayName: "Casey", role: "MEMBER", points: 5, isCurrentMember: true },
        { memberId: null, displayName: "Unattributed", role: null, points: 10, isCurrentMember: false },
      ] },
    ], houses);

    expect(result.map(({ memberId, points, rank }) => ({ memberId, points, rank }))).toEqual([
      { memberId: "moved", points: 5, rank: 1 },
      { memberId: "current", points: 5, rank: 1 },
    ]);
    expect(result[0].houseName).toBe("Dragon");
  });
});

describe("contributorInitials", () => {
  it("matches the two-initial web avatar treatment", () => {
    expect(contributorInitials("  Ada Lovelace Byron ")).toBe("AL");
  });
});
