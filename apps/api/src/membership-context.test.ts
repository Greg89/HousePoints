import { describe, expect, it } from "vitest";
import { pickPreferredMembership } from "./membership-context";

describe("pickPreferredMembership", () => {
  const memberships = [
    { id: "membership-1", organizationId: "org-1" },
    { id: "membership-2", organizationId: "org-2" },
  ];

  it("prefers the active membership matching the legacy current organization shadow", () => {
    expect(pickPreferredMembership(memberships, "org-2")).toEqual({
      id: "membership-2",
      organizationId: "org-2",
    });
  });

  it("falls back to the first active membership when the legacy shadow is empty or stale", () => {
    expect(pickPreferredMembership(memberships, null)).toEqual({
      id: "membership-1",
      organizationId: "org-1",
    });
    expect(pickPreferredMembership(memberships, "org-stale")).toEqual({
      id: "membership-1",
      organizationId: "org-1",
    });
  });

  it("returns null when no active memberships are available", () => {
    expect(pickPreferredMembership([], "org-1")).toBeNull();
    expect(pickPreferredMembership(undefined, "org-1")).toBeNull();
  });
});
