import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActivityItem } from "@housepoints/contracts";
import { ActivityFeed } from "./ActivityFeed";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial,
      animate,
      transition,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
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

const baseActivity: ActivityItem = {
  id: "activity-1",
  actorName: "Alice",
  targetUserName: "Ben",
  targetHouseName: "Phoenix",
  targetHouseColor: "#7c3aed",
  delta: 10,
  reason: "Great collaboration",
  trait: "COLLABORATION",
  createdAt: new Date().toISOString(),
  season: {
    id: "season-active",
    name: "Q3 2026",
    isActive: true,
  },
};

describe("ActivityFeed", () => {
  it("shows an empty state without a load-more button", () => {
    render(
      <ActivityFeed
        items={[]}
        nextCursor={null}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByText("No activity yet. Award some points!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("appends the next activity page and hides the button when exhausted", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn(async () => ({
      items: [
        {
          ...baseActivity,
          id: "activity-2",
          targetUserName: "Cara",
          reason: "Unblocked the release",
        },
      ],
      nextCursor: null,
    }));

    render(
      <ActivityFeed
        items={[baseActivity]}
        nextCursor="activity-1"
        onLoadMore={onLoadMore}
      />,
    );

    await user.click(screen.getByRole("button", { name: /load more/i }));

    expect(onLoadMore).toHaveBeenCalledWith("activity-1");
    expect(await screen.findByText("Cara")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("keeps the cursor available and shows a safe error when loading fails", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn(async () => {
      throw new Error("database details");
    });

    render(
      <ActivityFeed
        items={[baseActivity]}
        nextCursor="activity-1"
        onLoadMore={onLoadMore}
      />,
    );

    await user.click(screen.getByRole("button", { name: /load more/i }));

    expect(await screen.findByText("More activity could not be loaded. Please try again.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /load more/i })).toBeEnabled();
    });
  });
});
