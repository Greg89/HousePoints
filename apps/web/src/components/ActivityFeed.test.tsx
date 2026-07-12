import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActivityItem, OrgMember } from "@housepoints/contracts";
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

const members: OrgMember[] = [
  {
    id: "user-ben",
    displayName: "Ben",
    role: "MEMBER",
    houseId: "house-1",
    houseName: "Phoenix",
    houseColor: "#7c3aed",
  },
  {
    id: "user-cara",
    displayName: "Cara",
    role: "MEMBER",
    houseId: "house-2",
    houseName: "Orion",
    houseColor: "#0ea5e9",
  },
];

describe("ActivityFeed", () => {
  it("shows an empty state without a load-more button", () => {
    render(
      <ActivityFeed
        items={[]}
        members={members}
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
        members={members}
        nextCursor="activity-1"
        onLoadMore={onLoadMore}
      />,
    );

    await user.click(screen.getByRole("button", { name: /load more/i }));

    expect(onLoadMore).toHaveBeenCalledWith({ cursor: "activity-1" });
    expect(await screen.findByText("Unblocked the release")).toBeInTheDocument();
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
        members={members}
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

  it("loads a server-backed member filtered page and keeps the filter for pagination", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi
      .fn()
      .mockResolvedValueOnce({
        items: [
          {
            ...baseActivity,
            id: "member-page-1",
            targetUserName: "Ben",
            reason: "Helped onboard the team",
          },
        ],
        nextCursor: "member-page-1",
      })
      .mockResolvedValueOnce({
        items: [
          {
            ...baseActivity,
            id: "member-page-2",
            targetUserName: "Ben",
            reason: "Made the sprint smoother",
          },
        ],
        nextCursor: null,
      });

    render(
      <ActivityFeed
        items={[baseActivity]}
        members={members}
        nextCursor={null}
        onLoadMore={onLoadMore}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/member/i), "user-ben");

    expect(onLoadMore).toHaveBeenCalledWith({ targetUserId: "user-ben" });
    expect(await screen.findByText("Helped onboard the team")).toBeInTheDocument();
    expect(screen.queryByText("Great collaboration")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /load more activity/i }));

    expect(onLoadMore).toHaveBeenLastCalledWith({
      cursor: "member-page-1",
      targetUserId: "user-ben",
    });
    expect(await screen.findByText("Made the sprint smoother")).toBeInTheDocument();
  });

  it("keeps the cursor available and shows a safe error when loading fails", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn(async () => {
      throw new Error("database details");
    });

    render(
      <ActivityFeed
        items={[baseActivity]}
        members={members}
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
        members={members}
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

  it("lets a user react to an award and updates the card summary", async () => {
    const user = userEvent.setup();
    const onReact = vi.fn(async () => ({
      ok: true as const,
      reaction: {
        transactionId: "activity-1",
        myReactionKey: "heart" as const,
        reactions: [{ reactionKey: "heart" as const, count: 1 }],
      },
    }));

    render(
      <ActivityFeed
        items={[baseActivity]}
        members={members}
        nextCursor={null}
        onLoadMore={vi.fn()}
        onReact={onReact}
      />,
    );

    await user.click(screen.getByRole("button", { name: /open reactions for ben/i }));
    await user.click(screen.getByRole("menuitem", { name: /react with love it/i }));

    await waitFor(() => expect(onReact).toHaveBeenCalledWith("activity-1", "heart"));
    const selectedReaction = await screen.findByRole("menuitem", { name: /remove love it reaction/i });
    expect(selectedReaction).toHaveAttribute("aria-pressed", "true");
    expect(selectedReaction).toHaveTextContent("1");
  });

  it("shows the compact reaction picker with the full positive reaction set", async () => {
    const user = userEvent.setup();
    render(
      <ActivityFeed
        items={[baseActivity]}
        members={members}
        nextCursor={null}
        onLoadMore={vi.fn()}
        onReact={vi.fn()}
      />,
    );

    expect(screen.queryByRole("menuitem", { name: /react with applause/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open reactions for ben/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open reactions for ben/i }));

    expect(screen.getByRole("menuitem", { name: /react with applause/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /react with love it/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /react with on fire/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /react with celebrate/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /react with great work/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /react with sparkles/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /react with trophy/i })).toBeInTheDocument();
  });

  it("shows reaction details from the activity actions menu", async () => {
    const user = userEvent.setup();
    const onReadReactions = vi.fn(async () => ({
      ok: true as const,
      details: {
        transactionId: "activity-1",
        reactions: [
          {
            id: "reaction-1",
            reactionKey: "party" as const,
            actorUserId: "user-cara",
            actorName: "Cara",
            createdAt: "2026-06-25T12:00:00.000Z",
            updatedAt: "2026-06-25T12:05:00.000Z",
          },
        ],
      },
    }));

    render(
      <ActivityFeed
        items={[
          {
            ...baseActivity,
            reactions: [{ reactionKey: "party", count: 1 }],
          },
        ]}
        members={members}
        nextCursor={null}
        onLoadMore={vi.fn()}
        onReadReactions={onReadReactions}
      />,
    );

    await user.click(screen.getByRole("button", { name: /activity actions for ben/i }));
    await user.click(screen.getByRole("menuitem", { name: /view reactions/i }));

    await waitFor(() => expect(onReadReactions).toHaveBeenCalledWith("activity-1"));
    const dialog = await screen.findByRole("dialog", { name: /reactions/i });
    expect(within(dialog).getByText("Cara")).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: "Celebrate" })).toBeInTheDocument();
    expect(within(dialog).queryByText("Celebrate")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Great collaboration")).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: /reaction details list/i })).toHaveClass("overflow-y-auto");
  });

  it("shows a safe error when reaction details fail to load", async () => {
    const user = userEvent.setup();
    const onReadReactions = vi.fn(async () => ({
      ok: false as const,
      code: "POINT_TRANSACTION_NOT_FOUND",
      message: "Point transaction was not found",
    }));

    render(
      <ActivityFeed
        items={[
          {
            ...baseActivity,
            reactions: [{ reactionKey: "heart", count: 1 }],
          },
        ]}
        members={members}
        nextCursor={null}
        onLoadMore={vi.fn()}
        onReadReactions={onReadReactions}
      />,
    );

    await user.click(screen.getByRole("button", { name: /activity actions for ben/i }));
    await user.click(screen.getByRole("menuitem", { name: /view reactions/i }));

    const dialog = await screen.findByRole("dialog", { name: /reactions/i });
    expect(await within(dialog).findByText("Point transaction was not found")).toBeInTheDocument();
  });

  it("sends null when the selected reaction is clicked again", async () => {
    const user = userEvent.setup();
    const onReact = vi.fn(async () => ({
      ok: true as const,
      reaction: {
        transactionId: "activity-1",
        myReactionKey: null,
        reactions: [],
      },
    }));

    render(
      <ActivityFeed
        items={[
          {
            ...baseActivity,
            myReactionKey: "heart",
            reactions: [{ reactionKey: "heart", count: 1 }],
          },
        ]}
        members={members}
        nextCursor={null}
        onLoadMore={vi.fn()}
        onReact={onReact}
      />,
    );

    await user.click(screen.getByRole("button", { name: /open reactions for ben/i }));
    await user.click(screen.getByRole("menuitem", { name: /remove love it reaction/i }));

    await waitFor(() => expect(onReact).toHaveBeenCalledWith("activity-1", null));
    expect(await screen.findByRole("menuitem", { name: /react with love it/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a safe error when a reaction mutation fails", async () => {
    const user = userEvent.setup();
    const onReact = vi.fn(async () => ({
      ok: false as const,
      code: "POINT_TRANSACTION_NOT_FOUND",
      message: "Point transaction was not found",
    }));

    render(
      <ActivityFeed
        items={[baseActivity]}
        members={members}
        nextCursor={null}
        onLoadMore={vi.fn()}
        onReact={onReact}
      />,
    );

    await user.click(screen.getByRole("button", { name: /open reactions for ben/i }));
    await user.click(screen.getByRole("menuitem", { name: /react with applause/i }));

    expect(await screen.findByText("Point transaction was not found")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /react with applause/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not show reaction controls for deductions", () => {
    render(
      <ActivityFeed
        items={[
          {
            ...baseActivity,
            type: "DEDUCTION",
            delta: -10,
            trait: null,
          },
        ]}
        members={members}
        nextCursor={null}
        onLoadMore={vi.fn()}
        onReact={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /react with/i })).not.toBeInTheDocument();
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
        members={members}
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
        members={members}
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
