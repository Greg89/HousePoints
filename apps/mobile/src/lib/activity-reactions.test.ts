import { describe, expect, it } from "vitest";
import type { ActivityItem } from "@housepoints/contracts";

import { nextReactionKey, optimisticReactionResponse } from "./activity-reactions";

const item = (overrides: Partial<ActivityItem> = {}): ActivityItem => ({
  id: "point-1",
  type: "AWARD",
  actorName: "Alice",
  targetUserName: "Bob",
  targetHouseName: "Blue",
  targetHouseColor: "#0000ff",
  delta: 5,
  reason: "Great work",
  trait: "LEADERSHIP",
  createdAt: "2026-07-30T12:00:00.000Z",
  season: null,
  myReactionKey: null,
  reactions: [],
  ...overrides,
});

describe("nextReactionKey", () => {
  it("selects a new reaction and toggles the selected reaction off", () => {
    expect(nextReactionKey(null, "clap")).toBe("clap");
    expect(nextReactionKey("clap", "clap")).toBeNull();
    expect(nextReactionKey("clap", "heart")).toBe("heart");
  });
});

describe("optimisticReactionResponse", () => {
  it("adds the selected reaction", () => {
    expect(optimisticReactionResponse(item(), "clap")).toEqual({
      transactionId: "point-1",
      myReactionKey: "clap",
      reactions: [{ reactionKey: "clap", count: 1 }],
    });
  });

  it("moves the current user's count between reactions", () => {
    const result = optimisticReactionResponse(item({
      myReactionKey: "clap",
      reactions: [
        { reactionKey: "clap", count: 2 },
        { reactionKey: "heart", count: 1 },
      ],
    }), "heart");
    expect(result.myReactionKey).toBe("heart");
    expect(result.reactions).toEqual([
      { reactionKey: "clap", count: 1 },
      { reactionKey: "heart", count: 2 },
    ]);
  });

  it("removes empty reaction summaries when toggled off", () => {
    expect(optimisticReactionResponse(item({
      myReactionKey: "clap",
      reactions: [{ reactionKey: "clap", count: 1 }],
    }), null).reactions).toEqual([]);
  });
});

