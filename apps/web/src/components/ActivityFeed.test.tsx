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
  type: "AWARD",
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

    expect(screen.getByText("No team activity yet. Award some points!")).toBeInTheDocument();
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

    expect(onLoadMore).toHaveBeenCalledWith({ cursor: "activity-1" });
    expect(await screen.findByText("Cara")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("loads a server-backed filtered page and keeps the filter for pagination", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi
      .fn()
      .mockResolvedValueOnce({
        items: [
          {
            ...baseActivity,
            id: "deduction-1",
            type: "DEDUCTION",
            targetUserName: "Dana",
            delta: -10,
            reason: "Missed handoff",
            trait: null,
          },
        ],
        nextCursor: "deduction-1",
      })
      .mockResolvedValueOnce({
        items: [
          {
            ...baseActivity,
            id: "deduction-2",
            type: "DEDUCTION",
            targetUserName: "Evan",
            delta: -10,
            reason: "Late follow-up",
            trait: null,
          },
        ],
        nextCursor: null,
      });

    render(
      <ActivityFeed
        items={[baseActivity]}
        nextCursor={null}
        onLoadMore={onLoadMore}
      />,
    );

    await user.click(screen.getByRole("button", { name: /deductions/i }));

    expect(onLoadMore).toHaveBeenCalledWith({ type: "DEDUCTION" });
    expect(await screen.findByText("Missed handoff")).toBeInTheDocument();
    expect(screen.queryByText("Great collaboration")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /load more activity/i }));

    expect(onLoadMore).toHaveBeenLastCalledWith({
      cursor: "deduction-1",
      type: "DEDUCTION",
    });
    expect(await screen.findByText("Late follow-up")).toBeInTheDocument();
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

  it("lets admins delete an activity item after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => ({ ok: true as const }));

    render(
      <ActivityFeed
        items={[baseActivity]}
        nextCursor={null}
        onLoadMore={vi.fn()}
        canDelete
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: /activity actions for ben/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete point transaction/i }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("activity-1"));
    expect(confirmSpy).toHaveBeenCalledWith(
      "Delete this 10-point award to Ben? Scores will be recalculated without it.",
    );
    expect(screen.queryByText("Great collaboration")).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("shows a safe error when deletion returns an expected failure", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => ({
      ok: false as const,
      code: "POINT_TRANSACTION_ALREADY_DELETED",
      message: "Point transaction is already deleted",
    }));

    render(
      <ActivityFeed
        items={[baseActivity]}
        nextCursor={null}
        onLoadMore={vi.fn()}
        canDelete
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: /activity actions for ben/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete point transaction/i }));

    expect(await screen.findByText("Point transaction is already deleted")).toBeInTheDocument();
    expect(screen.getByText("Great collaboration")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("labels deductions with a negative point value", () => {
    render(
      <ActivityFeed
        items={[
          {
            ...baseActivity,
            type: "DEDUCTION",
            delta: -10,
            reason: "Missed the agreed cleanup rotation",
            trait: null,
          },
        ]}
        nextCursor={null}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByText("deducted")).toBeInTheDocument();
    expect(screen.getByText("Deducted")).toBeInTheDocument();
    expect(screen.getByText("-10")).toBeInTheDocument();
    expect(screen.queryByText("awarded")).not.toBeInTheDocument();
  });
});
