import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardShell } from "./DashboardShell";

vi.mock("framer-motion", () => ({
  motion: {
    button: ({
      children,
      whileHover,
      whileTap,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      whileHover?: unknown;
      whileTap?: unknown;
    }) => {
      void whileHover;
      void whileTap;
      return <button {...props}>{children}</button>;
    },
  },
}));

vi.mock("./HouseCard", () => ({
  HouseCard: ({
    house,
    selected,
    onSelect,
  }: {
    house: { name: string };
    selected?: boolean;
    onSelect?: () => void;
  }) => (
    <button type="button" aria-pressed={selected} onClick={onSelect}>
      {house.name}
    </button>
  ),
}));

vi.mock("./Leaderboard", () => ({
  Leaderboard: ({
    memberPoints,
    seasonName,
  }: {
    memberPoints: { memberId: string; points: number }[];
    seasonName?: string;
  }) => (
    <section>
      Leaderboard content
      {seasonName ? <span>{seasonName}</span> : null}
      {memberPoints.map((memberPoint) => (
        <span key={memberPoint.memberId}>{memberPoint.points}</span>
      ))}
    </section>
  ),
}));

vi.mock("./ActivityFeed", () => ({
  ActivityFeed: ({
    nextCursor,
  }: {
    nextCursor: string | null;
  }) => (
    <section>
      Activity content
      {nextCursor ? <span>Next cursor: {nextCursor}</span> : null}
    </section>
  ),
}));

vi.mock("./AwardPointsDialog", () => ({
  AwardPointsDialog: () => null,
}));

const activeSeason = {
  id: "season-active",
  name: "Q3 2026",
  startsAt: "2026-07-01T00:00:00.000Z",
  endsAt: null,
  isActive: true,
};

const historicalSeason = {
  id: "season-0",
  name: "Season 0",
  startsAt: "2026-06-01T00:00:00.000Z",
  endsAt: "2026-07-01T00:00:00.000Z",
  isActive: false,
};

const activitySeason = {
  id: activeSeason.id,
  name: activeSeason.name,
  isActive: activeSeason.isActive,
};

const historicalActivitySeason = {
  id: historicalSeason.id,
  name: historicalSeason.name,
  isActive: historicalSeason.isActive,
};

const baseProps = {
  session: {
    userName: "Gregory Dodson",
    houseId: "house-1",
    houseName: "Slytherin",
    houseColor: "#22c55e",
    role: "MEMBER" as const,
  },
  leaderboard: [
    {
      id: "house-1",
      name: "Slytherin",
      color: "#22c55e",
      description: "Values ambition.",
      score: 150,
      transactions: 3,
      memberCount: 2,
    },
    {
      id: "house-2",
      name: "Ravenclaw",
      color: "#1d4ed8",
      description: "Values intelligence.",
      score: 90,
      transactions: 2,
      memberCount: 1,
    },
  ],
  members: [
    {
      id: "member-1",
      displayName: "Alice Assigned",
      role: "MEMBER" as const,
      houseId: "house-1",
      houseName: "Slytherin",
      houseColor: "#22c55e",
    },
    {
      id: "member-2",
      displayName: "Ben Scorer",
      role: "ADMIN" as const,
      houseId: "house-1",
      houseName: "Slytherin",
      houseColor: "#22c55e",
    },
    {
      id: "member-3",
      displayName: "Cara Clever",
      role: "MEMBER" as const,
      houseId: "house-2",
      houseName: "Ravenclaw",
      houseColor: "#1d4ed8",
    },
  ],
  activity: [
    {
      id: "activity-1",
      actorName: "Gregory Dodson",
      targetUserName: "Ben Scorer",
      targetHouseName: "Slytherin",
      targetHouseColor: "#22c55e",
      delta: 25,
      reason: "Helped the team",
      trait: "COLLABORATION" as const,
      createdAt: new Date().toISOString(),
      season: activitySeason,
    },
    {
      id: "activity-2",
      actorName: "Gregory Dodson",
      targetUserName: "Cara Clever",
      targetHouseName: "Ravenclaw",
      targetHouseColor: "#1d4ed8",
      delta: 10,
      reason: "Great research",
      trait: "INNOVATION" as const,
      createdAt: new Date().toISOString(),
      season: activitySeason,
    },
  ],
  activityNextCursor: "activity-2",
  onLoadMoreActivity: vi.fn(async () => ({
    items: [],
    nextCursor: null,
  })),
  memberPoints: [
    { memberId: "member-2", points: 25 },
    { memberId: "member-1", points: 5 },
    { memberId: "member-3", points: 10 },
  ],
  dashboardSummary: {
    generatedAt: new Date().toISOString(),
    selectedSeason: activeSeason,
    seasonStartsAt: activeSeason.startsAt,
    seasonStandout: {
      memberId: "member-2",
      memberName: "Ben Scorer",
      houseId: "house-1",
      houseName: "Slytherin",
      houseColor: "#22c55e",
      points: 25,
    },
    seasonStandoutsByHouse: [
      {
        houseId: "house-1",
        standout: {
          memberId: "member-2",
          memberName: "Ben Scorer",
          houseId: "house-1",
          houseName: "Slytherin",
          houseColor: "#22c55e",
          points: 25,
        },
      },
      {
        houseId: "house-2",
        standout: {
          memberId: "member-3",
          memberName: "Cara Clever",
          houseId: "house-2",
          houseName: "Ravenclaw",
          houseColor: "#1d4ed8",
          points: 10,
        },
      },
    ],
    monthStartsAt: activeSeason.startsAt,
    monthlyStandout: {
      memberId: "member-2",
      memberName: "Ben Scorer",
      houseId: "house-1",
      houseName: "Slytherin",
      houseColor: "#22c55e",
      points: 25,
    },
    monthlyStandoutsByHouse: [
      {
        houseId: "house-1",
        standout: {
          memberId: "member-2",
          memberName: "Ben Scorer",
          houseId: "house-1",
          houseName: "Slytherin",
          houseColor: "#22c55e",
          points: 25,
        },
      },
      {
        houseId: "house-2",
        standout: {
          memberId: "member-3",
          memberName: "Cara Clever",
          houseId: "house-2",
          houseName: "Ravenclaw",
          houseColor: "#1d4ed8",
          points: 10,
        },
      },
    ],
    traitLeaders: [
      {
        houseId: "house-1",
        houseName: "Slytherin",
        houseColor: "#22c55e",
        trait: "COLLABORATION" as const,
        count: 1,
      },
      {
        houseId: "house-2",
        houseName: "Ravenclaw",
        houseColor: "#1d4ed8",
        trait: "INNOVATION" as const,
        count: 1,
      },
    ],
    recentActivity: [
      {
        id: "activity-1",
        actorName: "Gregory Dodson",
        targetUserName: "Ben Scorer",
        targetHouseName: "Slytherin",
        targetHouseColor: "#22c55e",
        delta: 25,
        reason: "Helped the team",
        trait: "COLLABORATION" as const,
        createdAt: new Date().toISOString(),
        season: activitySeason,
      },
      {
        id: "activity-2",
        actorName: "Gregory Dodson",
        targetUserName: "Cara Clever",
        targetHouseName: "Ravenclaw",
        targetHouseColor: "#1d4ed8",
        delta: 10,
        reason: "Great research",
        trait: "INNOVATION" as const,
        createdAt: new Date().toISOString(),
        season: activitySeason,
      },
    ],
    pointsVelocity: [
      {
        houseId: "house-1",
        houseName: "Slytherin",
        houseColor: "#22c55e",
        days: [
          { date: "2026-06-01", points: 0 },
          { date: "2026-06-02", points: 25 },
        ],
      },
      {
        houseId: "house-2",
        houseName: "Ravenclaw",
        houseColor: "#1d4ed8",
        days: [
          { date: "2026-06-01", points: 10 },
          { date: "2026-06-02", points: 0 },
        ],
      },
    ],
    houseMemberRankings: [
      {
        houseId: "house-1",
        members: [
          { memberId: "member-2", displayName: "Ben Scorer", role: "ADMIN" as const, points: 25 },
          { memberId: "member-1", displayName: "Alice Assigned", role: "MEMBER" as const, points: 5 },
        ],
      },
      {
        houseId: "house-2",
        members: [
          { memberId: "member-3", displayName: "Cara Clever", role: "MEMBER" as const, points: 10 },
        ],
      },
    ],
  },
  seasonContext: {
    activeSeason,
    seasons: [activeSeason, historicalSeason],
  },
  onSeasonChange: vi.fn(async () => ({
    dashboardSummary: {
      generatedAt: new Date().toISOString(),
      selectedSeason: historicalSeason,
      seasonStartsAt: historicalSeason.startsAt,
      seasonStandout: {
        memberId: "member-3",
        memberName: "Cara Clever",
        houseId: "house-2",
        houseName: "Ravenclaw",
        houseColor: "#1d4ed8",
        points: 10,
      },
      seasonStandoutsByHouse: [
        {
          houseId: "house-1",
          standout: null,
        },
        {
          houseId: "house-2",
          standout: {
            memberId: "member-3",
            memberName: "Cara Clever",
            houseId: "house-2",
            houseName: "Ravenclaw",
            houseColor: "#1d4ed8",
            points: 10,
          },
        },
      ],
      monthStartsAt: historicalSeason.startsAt,
      monthlyStandout: {
        memberId: "member-3",
        memberName: "Cara Clever",
        houseId: "house-2",
        houseName: "Ravenclaw",
        houseColor: "#1d4ed8",
        points: 10,
      },
      monthlyStandoutsByHouse: [
        {
          houseId: "house-1",
          standout: null,
        },
        {
          houseId: "house-2",
          standout: {
            memberId: "member-3",
            memberName: "Cara Clever",
            houseId: "house-2",
            houseName: "Ravenclaw",
            houseColor: "#1d4ed8",
            points: 10,
          },
        },
      ],
      traitLeaders: [
        {
          houseId: "house-2",
          houseName: "Ravenclaw",
          houseColor: "#1d4ed8",
          trait: "INNOVATION" as const,
          count: 1,
        },
      ],
      recentActivity: [
        {
          id: "activity-historical",
          actorName: "Gregory Dodson",
          targetUserName: "Cara Clever",
          targetHouseName: "Ravenclaw",
          targetHouseColor: "#1d4ed8",
          delta: 10,
          reason: "Great research",
          trait: "INNOVATION" as const,
          createdAt: new Date().toISOString(),
          season: historicalActivitySeason,
        },
      ],
      pointsVelocity: [
        {
          houseId: "house-2",
          houseName: "Ravenclaw",
          houseColor: "#1d4ed8",
          days: [{ date: "2026-06-01", points: 10 }],
        },
      ],
      houseMemberRankings: [
        {
          houseId: "house-2",
          members: [
            { memberId: "member-3", displayName: "Cara Clever", role: "MEMBER" as const, points: 10 },
          ],
        },
      ],
    },
    memberPoints: [{ memberId: "member-3", points: 10 }],
  })),
  onAward: async () => ({ ok: true as const }),
  loginUrl: "/auth/login",
  logoutUrl: "/auth/logout",
};

describe("DashboardShell", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the dashboard tabs focused for members", () => {
    render(<DashboardShell {...baseProps} />);

    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /activity/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /leaderboard/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /manage/i })).not.toBeInTheDocument();
  });

  it("shows admin tools only after an admin opens the Manage tab", async () => {
    const user = userEvent.setup();
    render(
      <DashboardShell
        {...baseProps}
        session={{ ...baseProps.session, role: "OWNER" }}
        adminSection={<div>Manage organization tools</div>}
      />,
    );

    const manageTab = screen.getByRole("tab", { name: /manage/i });
    expect(screen.queryByText("Manage organization tools")).not.toBeInTheDocument();

    await user.click(manageTab);

    expect(screen.getByText("Manage organization tools")).toBeVisible();
    expect(manageTab).toHaveAttribute("aria-selected", "true");
  });

  it("shows organization report widgets on the overview tab", () => {
    render(<DashboardShell {...baseProps} />);

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Organization report");
    expect(screen.getByText("Season standout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reporting season: q3 2026/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Current season status")).not.toBeInTheDocument();
    expect(screen.getByText("Trait leader per house")).toBeInTheDocument();
    expect(screen.getByText("Recent activity strip")).toBeInTheDocument();
    expect(screen.getByText("Points velocity")).toBeInTheDocument();
    expect(screen.getAllByText("Ben Scorer").length).toBeGreaterThan(0);
  });

  it("shows current season status on the overview tab when enabled", () => {
    render(<DashboardShell {...baseProps} showSeasonOverviewCard />);

    expect(screen.getByLabelText("Current season status")).toHaveTextContent("Current season");
    expect(screen.getByLabelText("Current season status")).toHaveTextContent("Q3 2026");
    expect(screen.getByLabelText("Current season status")).toHaveTextContent("No end date set");
  });

  it("shows a countdown when the active season has an end date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T12:00:00.000Z"));
    const activeSeasonWithEnd = {
      ...activeSeason,
      endsAt: "2026-07-10T12:00:00.000Z",
    };

    render(
      <DashboardShell
        {...baseProps}
        dashboardSummary={{
          ...baseProps.dashboardSummary,
          selectedSeason: activeSeasonWithEnd,
        }}
        seasonContext={{
          activeSeason: activeSeasonWithEnd,
          seasons: [activeSeasonWithEnd, historicalSeason],
        }}
        showSeasonOverviewCard
      />,
    );

    expect(screen.getByLabelText("Current season status")).toHaveTextContent("5 days remaining");
    expect(screen.getByLabelText("Current season status")).toHaveTextContent("ends Jul 10, 2026");
  });

  it("shows static season context when there is only one season", () => {
    render(
      <DashboardShell
        {...baseProps}
        seasonContext={{
          activeSeason,
          seasons: [activeSeason],
        }}
      />,
    );

    expect(screen.queryByRole("combobox", { name: /reporting season/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Reporting season: Q3 2026 (current)")).toBeInTheDocument();
  });

  it("uses an app-styled reporting season dropdown", async () => {
    const user = userEvent.setup();
    render(<DashboardShell {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /reporting season: q3 2026/i }));

    const listbox = screen.getByRole("listbox", { name: "Reporting season" });
    expect(listbox).toHaveClass("rounded-2xl", "bg-card");
    expect(within(listbox).getByRole("option", { name: "Q3 2026 (current)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(listbox).getByRole("option", { name: "Season 0" })).toBeInTheDocument();
  });

  it("loads overview and leaderboard reports for a selected historical season", async () => {
    const user = userEvent.setup();
    const onSeasonChange = vi.fn(baseProps.onSeasonChange);
    render(<DashboardShell {...baseProps} onSeasonChange={onSeasonChange} />);

    await user.click(screen.getByRole("button", { name: /reporting season: q3 2026/i }));
    await user.click(screen.getByRole("option", { name: "Season 0" }));

    expect(onSeasonChange).toHaveBeenCalledWith("season-0");
    expect(await screen.findByText("Historical view")).toBeInTheDocument();
    expect(screen.getByText("Historical season view")).toBeInTheDocument();
    expect(screen.getAllByText("Cara Clever").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("tab", { name: /leaderboard/i }));

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Season 0");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("10");
  });

  it("refreshes leaderboard points when the active season props update", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DashboardShell {...baseProps} memberPoints={[]} />);

    await user.click(screen.getByRole("tab", { name: /leaderboard/i }));

    expect(screen.getByRole("tabpanel")).not.toHaveTextContent("25");

    rerender(<DashboardShell {...baseProps} />);

    expect(screen.getByRole("tabpanel")).toHaveTextContent("25");
  });

  it("drills into a house report from a house card and can return to all houses", async () => {
    const user = userEvent.setup();
    render(<DashboardShell {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Slytherin" }));

    expect(screen.getByText("House report")).toBeInTheDocument();
    expect(screen.getByText("Slytherin members by points received")).toBeInTheDocument();
    expect(screen.getByText("Alice Assigned")).toBeInTheDocument();
    expect(screen.queryByText("Cara Clever")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back to all houses/i }));

    expect(screen.getByText("Organization report")).toBeInTheDocument();
  });

  it("clears house report focus when leaving the overview tab", async () => {
    const user = userEvent.setup();
    render(<DashboardShell {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Slytherin" }));

    expect(screen.getByText("House report")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /activity/i }));
    await user.click(screen.getByRole("tab", { name: /overview/i }));

    expect(screen.getByText("Organization report")).toBeInTheDocument();
    expect(screen.queryByText("Slytherin members by points received")).not.toBeInTheDocument();
  });

  it("opens the activity tab from the overview activity strip", async () => {
    const user = userEvent.setup();
    render(<DashboardShell {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /open activity/i }));

    expect(screen.getByRole("tab", { name: /activity/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Activity content")).toBeVisible();
    expect(screen.getByText("Next cursor: activity-2")).toBeVisible();
  });
});
