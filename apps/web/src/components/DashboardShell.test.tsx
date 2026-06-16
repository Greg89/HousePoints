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
  HouseCard: ({ house }: { house: { name: string } }) => <article>{house.name}</article>,
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
  ],
  members: [],
  activity: [],
  memberPoints: [],
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
});
