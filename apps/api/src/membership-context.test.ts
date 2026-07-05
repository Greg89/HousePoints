import { describe, expect, it } from "vitest";
import { pickPreferredMembership } from "./membership-context";

describe("pickPreferredMembership", () => {
  const memberships = [
    { id: "membership-1", organizationId: "org-1" },
    { id: "membership-2", organizationId: "org-2" },
  ];

  it("uses the first active membership", () => {
    expect(pickPreferredMembership(memberships)).toEqual({
      id: "membership-1",
      organizationId: "org-1",
    });
  });

  it("returns null when no active memberships are available", () => {
    expect(pickPreferredMembership([])).toBeNull();
    expect(pickPreferredMembership(undefined)).toBeNull();
  });
});
