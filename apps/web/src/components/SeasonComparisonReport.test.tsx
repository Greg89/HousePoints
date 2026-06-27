import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { SeasonComparisonReport } from "./SeasonComparisonReport";
import type { Season, SeasonComparison } from "@housepoints/contracts";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const activeSeason: Season = {
  id: "season-active",
  name: "Q3 2026",
  startsAt: "2026-07-01T00:00:00.000Z",
  endsAt: null,
  isActive: true,
};

const historicalSeason: Season = {
  id: "season-0",
  name: "Season 0",
  startsAt: "2026-06-01T00:00:00.000Z",
  endsAt: "2026-07-01T00:00:00.000Z",
  isActive: false,
};

const olderSeason: Season = {
  id: "season-old",
  name: "Launch Season",
  startsAt: "2026-05-01T00:00:00.000Z",
  endsAt: "2026-06-01T00:00:00.000Z",
  isActive: false,
};

const comparison: SeasonComparison = {
  fromSeason: historicalSeason,
  toSeason: activeSeason,
  houses: [
    {
      houseId: "house-1",
      houseName: "Slytherin",
      houseColor: "#22c55e",
      from: {
        rank: 2,
        points: 100,
        transactions: 4,
        averagePointsPerDay: 10,
        topContributor: {
          userId: "user-1",
          displayName: "Alice",
          points: 60,
        },
      },
      to: {
        rank: 1,
        points: 150,
        transactions: 6,
        averagePointsPerDay: 15,
        topContributor: {
          userId: "user-2",
          displayName: "Ben",
          points: 80,
        },
      },
      delta: {
        rankChange: 1,
        pointChange: 50,
        averagePointsPerDayChange: 5,
      },
    },
    {
      houseId: "house-2",
      houseName: "Ravenclaw",
      houseColor: "#1d4ed8",
      from: {
        rank: 1,
        points: 120,
        transactions: 5,
        averagePointsPerDay: 12,
        topContributor: null,
      },
      to: {
        rank: 2,
        points: 90,
        transactions: 3,
        averagePointsPerDay: 9,
        topContributor: null,
      },
      delta: {
        rankChange: -1,
        pointChange: -30,
        averagePointsPerDayChange: -3,
      },
    },
  ],
};

function getHouseRow(houseName: string) {
  const row = screen.getAllByText(houseName).find((element) => element.closest("article"));
  expect(row).toBeDefined();
  return row!.closest("article") as HTMLElement;
}

describe("SeasonComparisonReport", () => {
  it("shows an unavailable state until at least two seasons exist", () => {
    render(
      <SeasonComparisonReport
        seasons={[activeSeason]}
        initialComparison={null}
        onCompare={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Season comparison becomes available after another season exists."),
    ).toBeInTheDocument();
  });

  it("renders an initial comparison with house deltas and top contributors", () => {
    render(
      <SeasonComparisonReport
        seasons={[activeSeason, historicalSeason]}
        initialComparison={comparison}
        onCompare={vi.fn()}
      />,
    );

    expect(screen.getByRole("region", { name: "Season comparison report" })).toBeInTheDocument();
    expect(screen.getByText("Biggest point gain")).toBeInTheDocument();
    const slytherinRow = within(getHouseRow("Slytherin"));
    const ravenclawRow = within(getHouseRow("Ravenclaw"));

    expect(slytherinRow.getByText("Ben")).toBeInTheDocument();
    expect(slytherinRow.getByText("+50")).toBeInTheDocument();
    expect(ravenclawRow.getByText("-30")).toBeInTheDocument();
  });

  it("loads a new comparison when a season selection changes", async () => {
    const user = userEvent.setup();
    const nextComparison: SeasonComparison = {
      ...comparison,
      fromSeason: olderSeason,
      houses: [
        {
          ...comparison.houses[0],
          from: {
            ...comparison.houses[0].from,
            points: 10,
          },
          delta: {
            rankChange: 0,
            pointChange: 140,
            averagePointsPerDayChange: 14,
          },
        },
      ],
    };
    const onCompare = vi.fn().mockResolvedValue(nextComparison);
    render(
      <SeasonComparisonReport
        seasons={[activeSeason, historicalSeason, olderSeason]}
        initialComparison={comparison}
        onCompare={onCompare}
      />,
    );

    await user.selectOptions(screen.getByLabelText("From"), "season-old");

    await waitFor(() => {
      expect(onCompare).toHaveBeenCalledWith("season-old", "season-active");
    });
    await waitFor(() => {
      expect(screen.getAllByText("+140").length).toBeGreaterThan(0);
    });
  });

  it("shows an inline hint instead of loading when the same season is selected", async () => {
    const user = userEvent.setup();
    const onCompare = vi.fn();
    render(
      <SeasonComparisonReport
        seasons={[activeSeason, historicalSeason]}
        initialComparison={comparison}
        onCompare={onCompare}
      />,
    );

    await user.selectOptions(screen.getByLabelText("From"), "season-active");

    expect(screen.getByText("Choose two different seasons to compare.")).toBeInTheDocument();
    expect(onCompare).not.toHaveBeenCalled();
  });

  it("shows a no-activity state when both selected seasons are empty", () => {
    const emptyComparison: SeasonComparison = {
      fromSeason: historicalSeason,
      toSeason: activeSeason,
      houses: [
        {
          ...comparison.houses[0],
          from: {
            rank: 1,
            points: 0,
            transactions: 0,
            averagePointsPerDay: 0,
            topContributor: null,
          },
          to: {
            rank: 1,
            points: 0,
            transactions: 0,
            averagePointsPerDay: 0,
            topContributor: null,
          },
          delta: {
            rankChange: 0,
            pointChange: 0,
            averagePointsPerDayChange: 0,
          },
        },
      ],
    };

    render(
      <SeasonComparisonReport
        seasons={[activeSeason, historicalSeason]}
        initialComparison={emptyComparison}
        onCompare={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No point activity was recorded in either selected season."),
    ).toBeInTheDocument();
  });

  it("shows a safe toast when comparison loading fails", async () => {
    const user = userEvent.setup();
    const error = new Error("Season comparison could not be loaded. Please try again.");
    const onCompare = vi.fn().mockRejectedValue(error);
    render(
      <SeasonComparisonReport
        seasons={[activeSeason, historicalSeason, olderSeason]}
        initialComparison={comparison}
        onCompare={onCompare}
      />,
    );

    await user.selectOptions(screen.getByLabelText("From"), "season-old");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to compare seasons", {
        description: "Season comparison could not be loaded. Please try again.",
      });
    });
  });

  it("labels mobile metric blocks with the selected season names", () => {
    render(
      <SeasonComparisonReport
        seasons={[activeSeason, historicalSeason]}
        initialComparison={comparison}
        onCompare={vi.fn()}
      />,
    );

    const row = within(getHouseRow("Slytherin"));

    expect(row.getByText("Season 0")).toBeInTheDocument();
    expect(row.getByText("Q3 2026")).toBeInTheDocument();
  });
});
