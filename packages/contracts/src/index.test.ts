import { describe, it, expect } from "vitest";
import {
  adjustPointsSchema,
  bootstrapUserSchema,
  createHouseSchema,
  assignUserHouseSchema,
  updateProfileSchema,
  actorScopeSchema,
  memberScoreSchema,
} from "./index";

// ---------------------------------------------------------------------------
// adjustPointsSchema
// ---------------------------------------------------------------------------
describe("adjustPointsSchema", () => {
  const valid = {
    actorAuth0Sub: "auth0|abc123",
    targetUserId: "user_1",
    delta: 10,
    reason: "Great work on the sprint",
  };

  it("accepts a valid input", () => {
    expect(adjustPointsSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects delta = 0", () => {
    const result = adjustPointsSchema.safeParse({ ...valid, delta: 0 });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.delta).toBeDefined();
  });

  it("rejects negative delta", () => {
    const result = adjustPointsSchema.safeParse({ ...valid, delta: -5 });
    expect(result.success).toBe(false);
  });

  it("rejects delta > 100", () => {
    const result = adjustPointsSchema.safeParse({ ...valid, delta: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects fractional delta", () => {
    const result = adjustPointsSchema.safeParse({ ...valid, delta: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects reason shorter than 3 chars", () => {
    const result = adjustPointsSchema.safeParse({ ...valid, reason: "hi" });
    expect(result.success).toBe(false);
  });

  it("rejects reason longer than 240 chars", () => {
    const result = adjustPointsSchema.safeParse({ ...valid, reason: "x".repeat(241) });
    expect(result.success).toBe(false);
  });

  it("rejects empty actorAuth0Sub", () => {
    const result = adjustPointsSchema.safeParse({ ...valid, actorAuth0Sub: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// bootstrapUserSchema
// ---------------------------------------------------------------------------
describe("bootstrapUserSchema", () => {
  const valid = {
    auth0Sub: "auth0|xyz",
    displayName: "Alice",
  };

  it("accepts minimal valid input (no email, no org slug)", () => {
    expect(bootstrapUserSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts full valid input", () => {
    expect(
      bootstrapUserSchema.safeParse({
        ...valid,
        email: "alice@example.com",
        organizationSlug: "acme",
      }).success
    ).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = bootstrapUserSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects org slug shorter than 2 chars", () => {
    const result = bootstrapUserSchema.safeParse({ ...valid, organizationSlug: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects empty displayName", () => {
    const result = bootstrapUserSchema.safeParse({ ...valid, displayName: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createHouseSchema
// ---------------------------------------------------------------------------
describe("createHouseSchema", () => {
  const valid = {
    actorAuth0Sub: "auth0|admin",
    name: "Gryffindor",
    color: "#7c3aed",
  };

  it("accepts valid input with default color", () => {
    expect(createHouseSchema.safeParse(valid).success).toBe(true);
  });

  it("defaults color to #7c3aed when omitted", () => {
    const result = createHouseSchema.safeParse({ actorAuth0Sub: "auth0|a", name: "Phoenix" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.color).toBe("#7c3aed");
  });

  it("rejects color not matching #rrggbb", () => {
    expect(createHouseSchema.safeParse({ ...valid, color: "red" }).success).toBe(false);
    expect(createHouseSchema.safeParse({ ...valid, color: "#gg0000" }).success).toBe(false);
  });

  it("rejects house name shorter than 2 chars", () => {
    const result = createHouseSchema.safeParse({ ...valid, name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects house name longer than 80 chars", () => {
    const result = createHouseSchema.safeParse({ ...valid, name: "A".repeat(81) });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 280 chars", () => {
    const result = createHouseSchema.safeParse({ ...valid, description: "x".repeat(281) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// assignUserHouseSchema
// ---------------------------------------------------------------------------
describe("assignUserHouseSchema", () => {
  const valid = {
    actorAuth0Sub: "auth0|admin",
    targetUserId: "user_1",
    targetHouseId: "house_1",
  };

  it("accepts valid input", () => {
    expect(assignUserHouseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty targetUserId", () => {
    expect(assignUserHouseSchema.safeParse({ ...valid, targetUserId: "" }).success).toBe(false);
  });

  it("rejects empty targetHouseId", () => {
    expect(assignUserHouseSchema.safeParse({ ...valid, targetHouseId: "" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateProfileSchema
// ---------------------------------------------------------------------------
describe("updateProfileSchema", () => {
  const valid = { actorAuth0Sub: "auth0|abc", displayName: "Bob" };

  it("accepts valid input", () => {
    expect(updateProfileSchema.safeParse(valid).success).toBe(true);
  });

  it("trims whitespace from displayName", () => {
    const result = updateProfileSchema.safeParse({ ...valid, displayName: "  Bob  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.displayName).toBe("Bob");
  });

  it("rejects empty displayName after trim", () => {
    expect(updateProfileSchema.safeParse({ ...valid, displayName: "   " }).success).toBe(false);
  });

  it("rejects displayName longer than 120 chars", () => {
    expect(updateProfileSchema.safeParse({ ...valid, displayName: "A".repeat(121) }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// actorScopeSchema
// ---------------------------------------------------------------------------
describe("actorScopeSchema", () => {
  it("accepts non-empty auth0Sub", () => {
    expect(actorScopeSchema.safeParse({ actorAuth0Sub: "auth0|abc" }).success).toBe(true);
  });

  it("rejects empty auth0Sub", () => {
    expect(actorScopeSchema.safeParse({ actorAuth0Sub: "" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// memberScoreSchema
// ---------------------------------------------------------------------------
describe("memberScoreSchema", () => {
  it("accepts valid score", () => {
    expect(memberScoreSchema.safeParse({ memberId: "u1", points: 42 }).success).toBe(true);
  });

  it("accepts zero points", () => {
    expect(memberScoreSchema.safeParse({ memberId: "u1", points: 0 }).success).toBe(true);
  });

  it("rejects fractional points", () => {
    expect(memberScoreSchema.safeParse({ memberId: "u1", points: 1.5 }).success).toBe(false);
  });
});
