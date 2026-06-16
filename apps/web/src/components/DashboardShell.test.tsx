import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
  Leaderboard: () => <section>Leaderboard content</section>,
}));

vi.mock("./ActivityFeed", () => ({
  ActivityFeed: () => <section>Activity content</section>,
}));

vi.mock("./AwardPointsDialog", () => ({
  AwardPointsDialog: () => null,
}));

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
    },
  ],
  memberPoints: [
    { memberId: "member-2", points: 25 },
    { memberId: "member-1", points: 5 },
    { memberId: "member-3", points: 10 },
  ],
  onAward: async () => {},
  loginUrl: "/auth/login",
  logoutUrl: "/auth/logout",
};

describe("DashboardShell", () => {
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
    expect(screen.getByText("This month's standout")).toBeInTheDocument();
    expect(screen.getByText("Trait leader per house")).toBeInTheDocument();
    expect(screen.getByText("Recent activity strip")).toBeInTheDocument();
    expect(screen.getByText("Points velocity")).toBeInTheDocument();
    expect(screen.getAllByText("Ben Scorer").length).toBeGreaterThan(0);
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

  it("opens the activity tab from the overview activity strip", async () => {
    const user = userEvent.setup();
    render(<DashboardShell {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /open activity/i }));

    expect(screen.getByRole("tab", { name: /activity/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Activity content")).toBeVisible();
  });
});
