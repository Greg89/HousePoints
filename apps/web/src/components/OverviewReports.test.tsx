import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardSummary } from "@housepoints/contracts";
import { OverviewReports } from "./OverviewReports";

const summary: DashboardSummary = {
  generatedAt: "2026-09-27T00:00:00.000Z",
  selectedSeason: { id: "s", name: "Season", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-04-01T00:00:00.000Z", isActive: false },
  seasonStartsAt: "2026-01-01T00:00:00.000Z",
  monthStartsAt: "2026-01-01T00:00:00.000Z",
  seasonStandout: null,
  seasonStandoutsByHouse: [],
  monthlyStandout: null,
  monthlyStandoutsByHouse: [],
  traitLeaders: [],
  categoryLeaders: [],
  recentActivity: [],
  pointsVelocity: [],
  houseMemberRankings: [],
  seasonWinnerSummary: {
    seasonId: "s", seasonName: "Season", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-04-01T00:00:00.000Z",
    winningHouse: { houseId: "a", houseName: "Alpha", houseColor: "#111111", points: 0 },
    winningHouses: [
      { houseId: "a", houseName: "Alpha", houseColor: "#111111", points: 0 },
      { houseId: "b", houseName: "Beta", houseColor: "#222222", points: 0 },
    ],
    topContributor: null,
    topContributors: [],
    totalTransactions: 2, awardCount: 1, deductionCount: 1, awardedPoints: 5, deductedPoints: 5,
  },
};

describe("OverviewReports", () => {
  it("uses the shared house projection for standout and recorded member ranks", () => {
    const house = { id: "a", name: "Alpha", color: "#111111", description: null, score: 10, transactions: 2, memberCount: 2 };
    render(<OverviewReports dashboardSummary={{
      ...summary,
      seasonStandout: { memberId: "other", memberName: "Other standout", houseId: "b", houseName: "Beta", houseColor: "#222222", points: 100 },
      seasonStandoutsByHouse: [{ houseId: "a", standout: { memberId: "alice", memberName: "Alice", houseId: "a", houseName: "Alpha", houseColor: "#111111", points: 10 } }],
      houseMemberRankings: [{ houseId: "a", members: [{ memberId: "former", displayName: "Former contributor", role: null, points: 10, rank: 1 }] }],
    }} selectedHouse={house} onShowActivity={vi.fn()} />);
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.queryByText("Other standout")).toBeNull();
    expect(screen.getByText("Former contributor")).toBeTruthy();
    expect(screen.getByText("Former member")).toBeTruthy();
  });

  it("shows every tied winner even when net totals are zero", () => {
    render(<OverviewReports dashboardSummary={summary} onShowActivity={vi.fn()} />);
    const recap = screen.getByRole("article", { name: "Season recap" });
    expect(within(recap).getByText("Co-winning houses")).toBeTruthy();
    expect(within(recap).getByText("Alpha")).toBeTruthy();
    expect(within(recap).getByText("Beta")).toBeTruthy();
  });
});
