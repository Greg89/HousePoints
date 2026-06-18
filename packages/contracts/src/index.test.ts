import { describe, it, expect } from "vitest";
import {
  adjustPointsSchema,
  bootstrapUserSchema,
  createHouseSchema,
  assignUserHouseSchema,
  assignUserHouseResponseSchema,
  updateProfileSchema,
  updateProfileResponseSchema,
  actorScopeSchema,
  createSeasonSchema,
  createOrgSchema,
  createInviteSchema,
  inviteLinkSchema,
  joinOrgSchema,
  promoteUserSchema,
  renameSeasonSchema,
  seasonContextSchema,
  seasonScopedRequestSchema,
  seasonTransitionSchema,
  memberScoreSchema,
  memberScoresSchema,
  activityItemSchema,
  activityFeedSchema,
  dashboardSummarySchema,
  appUserSchema,
  leaderboardSchema,
  orgMembersSchema,
  adminContextSchema,
  pointAdjustmentResponseSchema,
  traitSchema,
  TRAITS,
  TRAIT_LABELS,
} from "./index";

// ---------------------------------------------------------------------------
// adjustPointsSchema
// ---------------------------------------------------------------------------
describe("adjustPointsSchema", () => {
  const valid = {
    targetUserId: "user_1",
    delta: 10,
    reason: "Great work on the sprint",
    trait: "COLLABORATION" as const,
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

  it("rejects an invalid trait value", () => {
    const result = adjustPointsSchema.safeParse({ ...valid, trait: "NOT_A_TRAIT" });
    expect(result.success).toBe(false);
  });

  it("rejects missing trait", () => {
    const withoutTrait: Partial<typeof valid> = { ...valid };
    delete withoutTrait.trait;

    const result = adjustPointsSchema.safeParse(withoutTrait);
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.trait).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// traitSchema
// ---------------------------------------------------------------------------
describe("traitSchema", () => {
  it("accepts every defined trait value", () => {
    for (const t of TRAITS) {
      expect(traitSchema.safeParse(t).success).toBe(true);
    }
  });

  it("rejects an unknown string", () => {
    expect(traitSchema.safeParse("SUPERHERO").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(traitSchema.safeParse("").success).toBe(false);
  });

  it("TRAIT_LABELS has an entry for every trait", () => {
    for (const t of TRAITS) {
      expect(TRAIT_LABELS[t]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// activityItemSchema
// ---------------------------------------------------------------------------
describe("activityItemSchema", () => {
  const base = {
    id: "tx-1",
    actorName: "Bob",
    targetUserName: "Alice",
    targetHouseName: "Phoenix",
    targetHouseColor: "#7c3aed",
    delta: 10,
    reason: "Great work",
    createdAt: new Date().toISOString(),
    season: {
      id: "season-active",
      name: "Q3 2026",
      isActive: true,
    },
  };

  it("accepts a valid item with a known trait", () => {
    const result = activityItemSchema.safeParse({ ...base, trait: "LEADERSHIP" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid item with trait: null", () => {
    const result = activityItemSchema.safeParse({ ...base, trait: null });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid trait in activity item", () => {
    const result = activityItemSchema.safeParse({ ...base, trait: "MADE_UP" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// bootstrapUserSchema
// ---------------------------------------------------------------------------
describe("bootstrapUserSchema", () => {
  const valid = {
    displayName: "Alice",
  };

  it("accepts minimal valid input (no email)", () => {
    expect(bootstrapUserSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts full valid input with email", () => {
    expect(
      bootstrapUserSchema.safeParse({
        ...valid,
        email: "alice@example.com",
      }).success
    ).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = bootstrapUserSchema.safeParse({ ...valid, email: "not-an-email" });
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
    name: "Gryffindor",
    color: "#7c3aed",
  };

  it("accepts valid input with default color", () => {
    expect(createHouseSchema.safeParse(valid).success).toBe(true);
  });

  it("defaults color to #7c3aed when omitted", () => {
    const result = createHouseSchema.safeParse({ name: "Phoenix" });
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
  const valid = { displayName: "Bob" };

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
  it("accepts an empty request body", () => {
    expect(actorScopeSchema.safeParse({}).success).toBe(true);
  });

  it("rejects caller-supplied identity", () => {
    expect(actorScopeSchema.safeParse({ actorAuth0Sub: "auth0|abc" }).success).toBe(false);
  });
});

describe("authenticated request schemas", () => {
  const cases = [
    [adjustPointsSchema, {
      targetUserId: "user-1",
      delta: 10,
      reason: "Great work",
      trait: "LEADERSHIP",
      actorAuth0Sub: "auth0|attacker",
    }],
    [bootstrapUserSchema, {
      displayName: "Alice",
      auth0Sub: "auth0|attacker",
    }],
    [createHouseSchema, {
      name: "Phoenix",
      actorAuth0Sub: "auth0|attacker",
    }],
    [assignUserHouseSchema, {
      targetUserId: "user-1",
      targetHouseId: "house-1",
      actorAuth0Sub: "auth0|attacker",
    }],
    [updateProfileSchema, {
      displayName: "Alice",
      actorAuth0Sub: "auth0|attacker",
    }],
    [createOrgSchema, {
      displayName: "Alice",
      orgName: "Acme",
      orgSlug: "acme",
      firstHouseName: "Phoenix",
      firstHouseColor: "#7c3aed",
      auth0Sub: "auth0|attacker",
    }],
    [createInviteSchema, {
      expiresInHours: 72,
      actorAuth0Sub: "auth0|attacker",
    }],
    [joinOrgSchema, {
      displayName: "Alice",
      inviteToken: "invite",
      auth0Sub: "auth0|attacker",
    }],
    [promoteUserSchema, {
      targetUserId: "user-1",
      role: "ADMIN",
      actorAuth0Sub: "auth0|attacker",
    }],
    [seasonScopedRequestSchema, {
      seasonId: "season-1",
      organizationId: "org-1",
    }],
    [createSeasonSchema, {
      name: "Q3 2026",
      actorAuth0Sub: "auth0|attacker",
    }],
    [renameSeasonSchema, {
      seasonId: "season-1",
      name: "Q3 2026",
      actorAuth0Sub: "auth0|attacker",
    }],
  ] as const;

  it.each(cases)("rejects identity fields from %#", (schema, input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });
});

describe("createOrgSchema", () => {
  const valid = {
    displayName: "Alice",
    orgName: "Acme",
    orgSlug: "acme",
    firstHouseName: "Phoenix",
    firstHouseColor: "#7c3aed",
  };

  it("accepts organization and first-house setup", () => {
    expect(createOrgSchema.safeParse(valid).success).toBe(true);
  });

  it("defaults the first house color", () => {
    const withoutColor: Partial<typeof valid> = { ...valid };
    delete withoutColor.firstHouseColor;

    const result = createOrgSchema.safeParse(withoutColor);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstHouseColor).toBe("#7c3aed");
    }
  });

  it("requires a valid first house", () => {
    expect(
      createOrgSchema.safeParse({ ...valid, firstHouseName: "" }).success,
    ).toBe(false);
    expect(
      createOrgSchema.safeParse({ ...valid, firstHouseColor: "purple" }).success,
    ).toBe(false);
  });
});

describe("season schemas", () => {
  const activeSeason = {
    id: "season-1",
    name: "Q3 2026",
    startsAt: "2026-07-01T00:00:00.000Z",
    endsAt: null,
    isActive: true,
  };
  const previousSeason = {
    id: "season-0",
    name: "Season 0",
    startsAt: "2026-06-01T00:00:00.000Z",
    endsAt: "2026-07-01T00:00:00.000Z",
    isActive: false,
  };

  it("accepts season context with active and historical seasons", () => {
    expect(
      seasonContextSchema.parse({
        activeSeason,
        seasons: [activeSeason, previousSeason],
      }),
    ).toEqual({
      activeSeason,
      seasons: [activeSeason, previousSeason],
    });
  });

  it("accepts empty and explicit season-scoped read requests", () => {
    expect(seasonScopedRequestSchema.parse({})).toEqual({});
    expect(seasonScopedRequestSchema.parse({ seasonId: "season-1" })).toEqual({
      seasonId: "season-1",
    });
  });

  it("accepts immediate season creation input only", () => {
    expect(createSeasonSchema.parse({ name: " Q4 2026 " })).toEqual({
      name: "Q4 2026",
    });
    expect(
      createSeasonSchema.safeParse({
        name: "Q4 2026",
        startsAt: "2026-10-01T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("accepts season rename input", () => {
    expect(
      renameSeasonSchema.parse({
        seasonId: "season-1",
        name: " Fall 2026 ",
      }),
    ).toEqual({
      seasonId: "season-1",
      name: "Fall 2026",
    });
  });

  it("accepts the start-season transition response", () => {
    expect(
      seasonTransitionSchema.parse({
        previousSeason,
        activeSeason,
      }),
    ).toEqual({
      previousSeason,
      activeSeason,
    });
  });

  it("rejects malformed season fields", () => {
    expect(
      seasonContextSchema.safeParse({
        activeSeason: { ...activeSeason, startsAt: "today" },
        seasons: [],
      }).success,
    ).toBe(false);
    expect(createSeasonSchema.safeParse({ name: "Q" }).success).toBe(false);
    expect(renameSeasonSchema.safeParse({ seasonId: "", name: "Q4 2026" }).success).toBe(false);
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

describe("dashboard response schemas", () => {
  const activityItem = {
    id: "tx-1",
    actorName: "Bob",
    targetUserName: "Alice",
    targetHouseName: "Phoenix",
    targetHouseColor: "#7c3aed",
    delta: 10,
    reason: "Great work",
    trait: "LEADERSHIP" as const,
    createdAt: "2026-06-01T12:00:00.000Z",
    season: {
      id: "season-active",
      name: "Q3 2026",
      isActive: true,
    },
  };

  it("accepts valid empty dashboard collections", () => {
    expect(leaderboardSchema.parse([])).toEqual([]);
    expect(orgMembersSchema.parse([])).toEqual([]);
    expect(activityFeedSchema.parse([])).toEqual([]);
    expect(memberScoresSchema.parse([])).toEqual([]);
  });

  it("rejects malformed items inside dashboard collections", () => {
    expect(
      leaderboardSchema.safeParse([{ id: "house-1", score: "10" }]).success,
    ).toBe(false);
    expect(
      orgMembersSchema.safeParse([{ id: "user-1", role: "SUPER_ADMIN" }])
        .success,
    ).toBe(false);
    expect(
      activityFeedSchema.safeParse([{ id: "tx-1", delta: "10" }]).success,
    ).toBe(false);
    expect(
      memberScoresSchema.safeParse([{ memberId: "user-1", points: 1.5 }])
        .success,
    ).toBe(false);
  });

  it("accepts a complete dashboard summary", () => {
    const summary = {
      generatedAt: "2026-06-16T12:00:00.000Z",
      selectedSeason: {
        id: "season-active",
        name: "Q3 2026",
        startsAt: "2026-06-01T00:00:00.000Z",
        endsAt: null,
        isActive: true,
      },
      seasonStartsAt: "2026-06-01T00:00:00.000Z",
      seasonStandout: {
        memberId: "user-1",
        memberName: "Alice",
        houseId: "house-1",
        houseName: "Phoenix",
        houseColor: "#7c3aed",
        points: 42,
      },
      seasonStandoutsByHouse: [
        {
          houseId: "house-1",
          standout: {
            memberId: "user-1",
            memberName: "Alice",
            houseId: "house-1",
            houseName: "Phoenix",
            houseColor: "#7c3aed",
            points: 42,
          },
        },
      ],
      monthStartsAt: "2026-06-01T00:00:00.000Z",
      monthlyStandout: {
        memberId: "user-1",
        memberName: "Alice",
        houseId: "house-1",
        houseName: "Phoenix",
        houseColor: "#7c3aed",
        points: 42,
      },
      monthlyStandoutsByHouse: [
        {
          houseId: "house-1",
          standout: {
            memberId: "user-1",
            memberName: "Alice",
            houseId: "house-1",
            houseName: "Phoenix",
            houseColor: "#7c3aed",
            points: 42,
          },
        },
      ],
      traitLeaders: [
        {
          houseId: "house-1",
          houseName: "Phoenix",
          houseColor: "#7c3aed",
          trait: "LEADERSHIP",
          count: 3,
        },
      ],
      recentActivity: [activityItem],
      pointsVelocity: [
        {
          houseId: "house-1",
          houseName: "Phoenix",
          houseColor: "#7c3aed",
          days: [{ date: "2026-06-16", points: 10 }],
        },
      ],
      houseMemberRankings: [
        {
          houseId: "house-1",
          members: [
            {
              memberId: "user-1",
              displayName: "Alice",
              role: "MEMBER",
              points: 42,
            },
          ],
        },
      ],
    };

    expect(dashboardSummarySchema.parse(summary)).toEqual(summary);
  });

  it("rejects malformed dashboard summary fields", () => {
    expect(
      dashboardSummarySchema.safeParse({
        generatedAt: "today",
        selectedSeason: {
          id: "season-active",
          name: "Q3 2026",
          startsAt: "2026-06-01T00:00:00.000Z",
          endsAt: null,
          isActive: true,
        },
        seasonStartsAt: "2026-06-01T00:00:00.000Z",
        seasonStandout: null,
        seasonStandoutsByHouse: [],
        monthStartsAt: "2026-06-01T00:00:00.000Z",
        monthlyStandout: null,
        monthlyStandoutsByHouse: [],
        traitLeaders: [],
        recentActivity: [],
        pointsVelocity: [],
        houseMemberRankings: [],
      }).success,
    ).toBe(false);
    expect(
      dashboardSummarySchema.safeParse({
        generatedAt: "2026-06-16T12:00:00.000Z",
        selectedSeason: {
          id: "season-active",
          name: "Q3 2026",
          startsAt: "2026-06-01T00:00:00.000Z",
          endsAt: null,
          isActive: true,
        },
        seasonStartsAt: "2026-06-01T00:00:00.000Z",
        seasonStandout: null,
        seasonStandoutsByHouse: [],
        monthStartsAt: "2026-06-01T00:00:00.000Z",
        monthlyStandout: null,
        monthlyStandoutsByHouse: [],
        traitLeaders: [],
        recentActivity: [],
        pointsVelocity: [{ houseId: "house-1", houseName: "Phoenix", houseColor: "#7c3aed", days: [{ date: "06/16/2026", points: 1 }] }],
        houseMemberRankings: [],
      }).success,
    ).toBe(false);
  });
});

describe("appUserSchema", () => {
  const valid = {
    id: "user-1",
    auth0Sub: "auth0|user-1",
    email: "alice@example.com",
    displayName: "Alice",
    role: "OWNER" as const,
    organizationId: "org-1",
    organizationSlug: "acme",
    houseId: "house-1",
    houseName: "Phoenix",
    houseColor: "#7c3aed",
    created: true,
  };

  it("accepts the user mapping returned by onboarding responses", () => {
    expect(appUserSchema.parse(valid)).toEqual(valid);
  });

  it("rejects invalid roles and missing creation state", () => {
    expect(appUserSchema.safeParse({ ...valid, role: "SUPER_ADMIN" }).success)
      .toBe(false);
    const withoutCreated: Partial<typeof valid> = { ...valid };
    delete withoutCreated.created;

    expect(appUserSchema.safeParse(withoutCreated).success).toBe(false);
  });
});

describe("adminContextSchema", () => {
  const valid = {
    organizationId: "org-1",
    organizationSlug: "acme",
    users: [
      {
        id: "user-1",
        displayName: "Alice",
        email: "alice@example.com",
        role: "OWNER",
        houseId: "house-1",
      },
    ],
    houses: [
      {
        id: "house-1",
        name: "Phoenix",
        color: "#7c3aed",
        description: null,
      },
    ],
  };

  it("accepts the complete admin context response", () => {
    expect(adminContextSchema.parse(valid)).toEqual(valid);
  });

  it("rejects malformed users and houses", () => {
    expect(
      adminContextSchema.safeParse({
        ...valid,
        users: [{ ...valid.users[0], role: "SUPER_ADMIN" }],
      }).success,
    ).toBe(false);
    expect(
      adminContextSchema.safeParse({
        ...valid,
        houses: [{ ...valid.houses[0], color: null }],
      }).success,
    ).toBe(false);
  });
});

describe("pointAdjustmentResponseSchema", () => {
  it("accepts a point adjustment response with a transaction id", () => {
    expect(
      pointAdjustmentResponseSchema.parse({
        id: "tx-1",
        delta: 10,
      }),
    ).toEqual({ id: "tx-1" });
  });

  it("rejects a response without a transaction id", () => {
    expect(
      pointAdjustmentResponseSchema.safeParse({ delta: 10 }).success,
    ).toBe(false);
    expect(pointAdjustmentResponseSchema.safeParse({ id: "" }).success).toBe(
      false,
    );
  });
});

describe("inviteLinkSchema", () => {
  const valid = {
    id: "invite-1",
    token: "single-use-token",
    expiresAt: "2026-06-18T12:00:00.000Z",
    usedAt: null,
  };

  it("accepts the one-time invite response", () => {
    expect(inviteLinkSchema.parse(valid)).toEqual(valid);
  });

  it("rejects missing tokens and malformed expiration timestamps", () => {
    expect(
      inviteLinkSchema.safeParse({ ...valid, token: "" }).success,
    ).toBe(false);
    expect(
      inviteLinkSchema.safeParse({ ...valid, expiresAt: "tomorrow" }).success,
    ).toBe(false);
    expect(
      inviteLinkSchema.safeParse({ ...valid, usedAt: "yesterday" }).success,
    ).toBe(false);
  });
});

describe("updateProfileResponseSchema", () => {
  it("accepts an updated user summary", () => {
    const response = {
      id: "user-1",
      displayName: "Alice Updated",
    };

    expect(updateProfileResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects missing user ids and invalid display names", () => {
    expect(
      updateProfileResponseSchema.safeParse({
        id: "",
        displayName: "Alice",
      }).success,
    ).toBe(false);
    expect(
      updateProfileResponseSchema.safeParse({
        id: "user-1",
        displayName: "",
      }).success,
    ).toBe(false);
  });
});

describe("assignUserHouseResponseSchema", () => {
  it("accepts an assigned user summary", () => {
    const response = {
      id: "user-1",
      displayName: "Alice",
      houseId: "house-1",
    };

    expect(assignUserHouseResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects missing ids and display names", () => {
    expect(
      assignUserHouseResponseSchema.safeParse({
        id: "",
        displayName: "Alice",
        houseId: "house-1",
      }).success,
    ).toBe(false);
    expect(
      assignUserHouseResponseSchema.safeParse({
        id: "user-1",
        displayName: "",
        houseId: "house-1",
      }).success,
    ).toBe(false);
    expect(
      assignUserHouseResponseSchema.safeParse({
        id: "user-1",
        displayName: "Alice",
        houseId: "",
      }).success,
    ).toBe(false);
  });
});
