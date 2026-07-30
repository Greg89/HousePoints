import { describe, expect, it } from "vitest";

import {
  eligibleDeductionMembers,
  pointDeductionErrorMessage,
} from "./point-deduction";

const members = [
  {
    id: "same",
    displayName: "Same House",
    role: "MEMBER" as const,
    houseId: "house-1",
    houseName: "One",
    houseColor: "#111111",
  },
  {
    id: "other",
    displayName: "Other House",
    role: "MEMBER" as const,
    houseId: "house-2",
    houseName: "Two",
    houseColor: "#222222",
  },
  {
    id: "unassigned",
    displayName: "Unassigned",
    role: "MEMBER" as const,
    houseId: null,
    houseName: null,
    houseColor: null,
  },
];

describe("eligibleDeductionMembers", () => {
  it("only returns assigned members from another house", () => {
    expect(
      eligibleDeductionMembers(members, "house-1").map((member) => member.id),
    ).toEqual(["other"]);
  });

  it("requires the actor to have a house and supports search", () => {
    expect(eligibleDeductionMembers(members, null)).toEqual([]);
    expect(eligibleDeductionMembers(members, "house-1", "missing")).toEqual([]);
  });
});

describe("pointDeductionErrorMessage", () => {
  it("maps cooldown failures to actionable messages", () => {
    expect(
      pointDeductionErrorMessage("DEDUCTION_COOLDOWN_ACTIVE", "fallback"),
    ).toContain("last 24 hours");
    expect(
      pointDeductionErrorMessage("TARGET_DEDUCTION_LIMIT_ACTIVE", "fallback"),
    ).toContain("member");
  });

  it("preserves the safe API fallback for unknown failures", () => {
    expect(pointDeductionErrorMessage("UNKNOWN", "Safe fallback")).toBe(
      "Safe fallback",
    );
  });
});

