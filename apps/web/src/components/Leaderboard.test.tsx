import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Leaderboard } from "./Leaderboard";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, initial, animate, transition, ...props }: React.HTMLAttributes<HTMLDivElement> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }) => {
      void initial;
      void animate;
      void transition;
      return <div {...props}>{children}</div>;
    },
  },
}));

describe("Leaderboard", () => {
  it("ranks active members without reserving a removed member's slot", () => {
    render(
      <Leaderboard
        members={[
          { id: "user-1", displayName: "Alice", role: "MEMBER", houseId: "house-1", houseName: "Phoenix", houseColor: "#7c3aed" },
          { id: "user-3", displayName: "Cora", role: "MEMBER", houseId: "house-2", houseName: "Ember", houseColor: "#ef4444" },
        ]}
        memberPoints={[
          { memberId: "user-1", points: 50 },
          { memberId: "user-removed", points: 40 },
          { memberId: "user-3", points: 30 },
        ]}
      />,
    );

    expect(screen.getByText("Alice").closest(".flex.items-center")?.querySelector(".text-yellow-500")).toBeTruthy();
    expect(screen.getByText("Cora").closest(".flex.items-center")?.querySelector(".text-slate-400")).toBeTruthy();
  });
});
