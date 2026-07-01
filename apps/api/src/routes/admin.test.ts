import { describe, it, expect, vi } from "vitest";
import { buildPointAdjustmentStats, buildRecentAdminActions } from "./admin.js";

vi.mock("@housepoints/db", () => ({
  prisma: {},
  isOrganizationSlugReserved: vi.fn(),
}));

describe("buildPointAdjustmentStats", () => {
  const houses = [
    { id: "h1", name: "Gryffindor", color: "#red" },
    { id: "h2", name: "Slytherin", color: "#green" },
  ];

  it("returns zero totals when deductionTotals is empty", () => {
    const result = buildPointAdjustmentStats(houses, null, []);

    expect(result.totalDeductionCount).toBe(0);
    expect(result.totalDeductedPoints).toBe(0);
    expect(result.seasonId).toBeNull();
    expect(result.seasonName).toBeNull();
    expect(result.byHouse).toHaveLength(2);
    expect(result.byHouse[0].deductionCount).toBe(0);
    expect(result.byHouse[0].deductedPoints).toBe(0);
  });

  it("populates season info when season is provided", () => {
    const result = buildPointAdjustmentStats(houses, { id: "s1", name: "Fall 2024" }, []);

    expect(result.seasonId).toBe("s1");
    expect(result.seasonName).toBe("Fall 2024");
  });

  it("aggregates totals and maps to houses correctly", () => {
    const deductionTotals = [
      { targetHouseId: "h1", _count: { _all: 3 }, _sum: { delta: -15 } },
      { targetHouseId: "h2", _count: { _all: 1 }, _sum: { delta: -5 } },
    ];
    const result = buildPointAdjustmentStats(houses, { id: "s1", name: "Spring" }, deductionTotals);

    expect(result.totalDeductionCount).toBe(4);
    expect(result.totalDeductedPoints).toBe(20);

    const gryff = result.byHouse.find((h) => h.houseId === "h1")!;
    expect(gryff.deductionCount).toBe(3);
    expect(gryff.deductedPoints).toBe(15);

    const slytherin = result.byHouse.find((h) => h.houseId === "h2")!;
    expect(slytherin.deductionCount).toBe(1);
    expect(slytherin.deductedPoints).toBe(5);
  });

  it("omits rows with null targetHouseId from byHouse but includes them in totals", () => {
    const deductionTotals = [
      { targetHouseId: "h1", _count: { _all: 2 }, _sum: { delta: -10 } },
      { targetHouseId: null, _count: { _all: 1 }, _sum: { delta: -3 } },
    ];
    const result = buildPointAdjustmentStats(houses, null, deductionTotals);

    expect(result.totalDeductionCount).toBe(3);
    expect(result.totalDeductedPoints).toBe(13);

    const h1 = result.byHouse.find((h) => h.houseId === "h1")!;
    expect(h1.deductionCount).toBe(2);

    const h2 = result.byHouse.find((h) => h.houseId === "h2")!;
    expect(h2.deductionCount).toBe(0);
  });

  it("handles null _sum.delta gracefully", () => {
    const deductionTotals = [
      { targetHouseId: "h1", _count: { _all: 1 }, _sum: { delta: null } },
    ];
    const result = buildPointAdjustmentStats(houses, null, deductionTotals);

    expect(result.totalDeductedPoints).toBe(0);
    expect(result.byHouse.find((h) => h.houseId === "h1")!.deductedPoints).toBe(0);
  });
});

describe("buildRecentAdminActions", () => {
  const now = new Date("2024-06-01T12:00:00Z");
  const earlier = new Date("2024-05-31T12:00:00Z");

  const emptyArgs = () => ({
    deletedPoints: [] as Parameters<typeof buildRecentAdminActions>[0],
    invites: [] as Parameters<typeof buildRecentAdminActions>[1],
    startedSeasons: [] as Parameters<typeof buildRecentAdminActions>[2],
    auditEvents: [] as Parameters<typeof buildRecentAdminActions>[3],
  });

  it("returns empty array when all inputs are empty", () => {
    const { deletedPoints, invites, startedSeasons, auditEvents } = emptyArgs();
    expect(buildRecentAdminActions(deletedPoints, invites, startedSeasons, auditEvents)).toEqual([]);
  });

  it("includes audit events as actions", () => {
    const { deletedPoints, invites, startedSeasons } = emptyArgs();
    const auditEvents = [
      {
        id: "evt1",
        eventType: "ORG_SETTINGS_UPDATED" as const,
        summary: "Admin renamed the org.",
        metadata: {},
        createdAt: now,
        actor: { displayName: "Alice" },
      },
    ];
    const result = buildRecentAdminActions(deletedPoints, invites, startedSeasons, auditEvents);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("audit-event:evt1");
    expect(result[0].type).toBe("ORG_SETTINGS_UPDATED");
    expect(result[0].actorName).toBe("Alice");
  });

  it("deduplicates deleted points already covered by audit events", () => {
    const { invites, startedSeasons } = emptyArgs();
    const auditEvents = [
      {
        id: "evt1",
        eventType: "POINT_DELETED" as const,
        summary: "Admin deleted points.",
        metadata: { transactionId: "pt1" },
        createdAt: now,
        actor: { displayName: "Alice" },
      },
    ];
    const deletedPoints = [
      {
        id: "pt1",
        delta: -5,
        deletedAt: now,
        deletedBy: { displayName: "Alice" },
        targetUser: { displayName: "Bob" },
      },
    ];
    const result = buildRecentAdminActions(deletedPoints, invites, startedSeasons, auditEvents);

    // The audit event covers pt1, so it should not appear twice
    expect(result.filter((a) => a.type === "POINT_DELETED")).toHaveLength(1);
    expect(result[0].id).toBe("audit-event:evt1");
  });

  it("adds deleted point action when not covered by audit event", () => {
    const { invites, startedSeasons, auditEvents } = emptyArgs();
    const deletedPoints = [
      {
        id: "pt99",
        delta: -10,
        deletedAt: now,
        deletedBy: { displayName: "Admin" },
        targetUser: { displayName: "Member" },
      },
    ];
    const result = buildRecentAdminActions(deletedPoints, invites, startedSeasons, auditEvents);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("point-deleted:pt99");
    expect(result[0].type).toBe("POINT_DELETED");
  });

  it("adds INVITE_CREATED and INVITE_USED actions for an invite not in audit log", () => {
    const { deletedPoints, startedSeasons, auditEvents } = emptyArgs();
    const invites = [
      {
        id: "inv1",
        createdAt: earlier,
        usedAt: now,
        expiresAt: new Date("2024-12-31T00:00:00Z"),
        createdBy: { displayName: "Owner" },
        usedBy: { displayName: "Newbie" },
      },
    ];
    const result = buildRecentAdminActions(deletedPoints, invites, startedSeasons, auditEvents);

    const created = result.find((a) => a.id === "invite-created:inv1");
    const used = result.find((a) => a.id === "invite-used:inv1");

    expect(created).toBeDefined();
    expect(created!.type).toBe("INVITE_CREATED");
    expect(used).toBeDefined();
    expect(used!.type).toBe("INVITE_USED");
  });

  it("deduplicates invite actions already covered by audit events", () => {
    const { deletedPoints, startedSeasons } = emptyArgs();
    const auditEvents = [
      {
        id: "evt1",
        eventType: "INVITE_CREATED" as const,
        summary: "Created invite.",
        metadata: { inviteId: "inv1" },
        createdAt: earlier,
        actor: { displayName: "Owner" },
      },
      {
        id: "evt2",
        eventType: "INVITE_USED" as const,
        summary: "Used invite.",
        metadata: { inviteId: "inv1" },
        createdAt: now,
        actor: { displayName: "Newbie" },
      },
    ];
    const invites = [
      {
        id: "inv1",
        createdAt: earlier,
        usedAt: now,
        expiresAt: new Date("2024-12-31T00:00:00Z"),
        createdBy: { displayName: "Owner" },
        usedBy: { displayName: "Newbie" },
      },
    ];
    const result = buildRecentAdminActions(deletedPoints, invites, startedSeasons, auditEvents);

    expect(result.filter((a) => a.type === "INVITE_CREATED")).toHaveLength(1);
    expect(result.filter((a) => a.type === "INVITE_USED")).toHaveLength(1);
  });

  it("sorts results by occurredAt descending", () => {
    const { invites, startedSeasons } = emptyArgs();
    const auditEvents = [
      {
        id: "evt1",
        eventType: "ORG_SETTINGS_UPDATED" as const,
        summary: "Earlier event.",
        metadata: {},
        createdAt: earlier,
        actor: null,
      },
      {
        id: "evt2",
        eventType: "USER_ROLE_CHANGED" as const,
        summary: "Later event.",
        metadata: {},
        createdAt: now,
        actor: null,
      },
    ];
    const result = buildRecentAdminActions([], invites, startedSeasons, auditEvents);

    expect(result[0].id).toBe("audit-event:evt2");
    expect(result[1].id).toBe("audit-event:evt1");
  });

  it("caps result at 10 items", () => {
    const { invites, startedSeasons } = emptyArgs();
    const auditEvents = Array.from({ length: 12 }, (_, i) => ({
      id: `evt${i}`,
      eventType: "ORG_SETTINGS_UPDATED" as const,
      summary: `Event ${i}`,
      metadata: {},
      createdAt: new Date(2024, 0, i + 1),
      actor: null,
    }));
    const result = buildRecentAdminActions([], invites, startedSeasons, auditEvents);

    expect(result).toHaveLength(10);
  });
});
