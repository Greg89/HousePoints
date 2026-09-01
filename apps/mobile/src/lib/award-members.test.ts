import type { OrgMember } from "@housepoints/contracts";
import { describe, expect, it } from "vitest";

import { eligibleAwardMembers } from "./award-members";

const members: OrgMember[] = [
  {
    id: "current-user",
    displayName: "Current User",
    role: "MEMBER",
    houseId: "house-1",
    houseName: "Blue",
    houseColor: "#0000ff",
  },
  {
    id: "member-z",
    displayName: "Zoe Member",
    role: "MEMBER",
    houseId: "house-2",
    houseName: "Red",
    houseColor: "#ff0000",
  },
  {
    id: "unassigned",
    displayName: "Unassigned Member",
    role: "MEMBER",
    houseId: null,
    houseName: null,
    houseColor: null,
  },
  {
    id: "member-a",
    displayName: "alice Member",
    role: "MEMBER",
    houseId: "house-1",
    houseName: "Blue",
    houseColor: "#0000ff",
  },
];

describe("eligibleAwardMembers", () => {
  it("returns assigned organization members except the current user", () => {
    expect(
      eligibleAwardMembers(members, "current-user").map((member) => member.id),
    ).toEqual(["member-a", "member-z"]);
  });

  it("returns an empty list while members are unavailable", () => {
    expect(eligibleAwardMembers(undefined, "current-user")).toEqual([]);
  });
});
