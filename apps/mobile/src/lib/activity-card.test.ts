import type { ActivityItem } from "@housepoints/contracts";
import { describe, expect, it } from "vitest";

import { activityCardPresentation } from "./activity-card";

const baseItem: ActivityItem = {
  id: "point-1",
  type: "AWARD",
  actorName: "Alice Giver",
  targetUserName: "Bob Recipient",
  targetHouseName: "Phoenix",
  targetHouseColor: "#dc2626",
  delta: 15,
  reason: "Led the project",
  trait: "LEADERSHIP",
  createdAt: "2026-09-13T16:00:00.000Z",
  season: null,
  myReactionKey: "heart",
  reactions: [
    { reactionKey: "clap", count: 2 },
    { reactionKey: "heart", count: 4 },
    { reactionKey: "fire", count: 3 },
    { reactionKey: "party", count: 1 },
  ],
};

describe("activityCardPresentation", () => {
  it("centers the recipient and treats the giver as attribution", () => {
    const result = activityCardPresentation(
      baseItem,
      new Date("2026-09-13T16:05:00.000Z").getTime(),
    );

    expect(result).toMatchObject({
      attributionLabel: "Recognized by",
      deltaLabel: "+15",
      isDeduction: false,
      targetInitial: "B",
      traitLabel: "Leadership",
      relativeTime: "5m ago",
    });
  });

  it("shows only the three most-used reactions and marks mine", () => {
    const result = activityCardPresentation(baseItem);

    expect(result.topReactions.map(({ reactionKey, count, mine }) => ({
      reactionKey,
      count,
      mine,
    }))).toEqual([
      { reactionKey: "heart", count: 4, mine: true },
      { reactionKey: "fire", count: 3, mine: false },
      { reactionKey: "clap", count: 2, mine: false },
    ]);
  });

  it("uses deduction-specific attribution and point formatting", () => {
    expect(activityCardPresentation({
      ...baseItem,
      type: "DEDUCTION",
      delta: -5,
      trait: null,
    })).toMatchObject({
      attributionLabel: "Deducted by",
      deltaLabel: "-5",
      isDeduction: true,
      traitLabel: null,
    });
  });
});
