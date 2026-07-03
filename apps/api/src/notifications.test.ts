import { describe, it, expect } from "vitest";
import {
  buildPointAwardNotificationData,
  buildPointDeductionNotificationData,
  buildSeasonStartedNotificationData,
  buildRoleChangedNotificationData,
  buildMemberNeedsAssignmentNotificationData,
} from "./notifications.js";

describe("buildPointAwardNotificationData", () => {
  const base = {
    organizationId: "org-1",
    recipientUserId: "user-2",
    actorDisplayName: "Alice",
    delta: 5,
    trait: "LEADERSHIP" as const,
    transactionId: "txn-1",
  };

  it("sets the correct notification type and severity", () => {
    const result = buildPointAwardNotificationData(base);
    expect(result.type).toBe("POINT_AWARD_RECEIVED");
    expect(result.severity).toBe("INFO");
  });

  it("generates the correct body with trait label", () => {
    const result = buildPointAwardNotificationData(base);
    expect(result.body).toBe("Alice awarded you 5 points for Leadership.");
  });

  it("generates the correct dedupeKey", () => {
    const result = buildPointAwardNotificationData(base);
    expect(result.dedupeKey).toBe("point-award-received:org-1:txn-1");
  });

  it("sets entityType and entityId to the transaction", () => {
    const result = buildPointAwardNotificationData(base);
    expect(result.entityType).toBe("PointTransaction");
    expect(result.entityId).toBe("txn-1");
  });

  it("routes to the activity tab", () => {
    const result = buildPointAwardNotificationData(base);
    expect(result.actionHref).toBe("/?tab=activity");
  });
});

describe("buildPointDeductionNotificationData", () => {
  const base = {
    organizationId: "org-1",
    recipientUserId: "user-2",
    actorDisplayName: "Admin",
    reason: "Misconduct",
    transactionId: "txn-9",
  };

  it("sets the correct notification type and severity", () => {
    const result = buildPointDeductionNotificationData(base);
    expect(result.type).toBe("POINT_DEDUCTION_RECEIVED");
    expect(result.severity).toBe("WARNING");
  });

  it("generates the correct body including reason", () => {
    const result = buildPointDeductionNotificationData(base);
    expect(result.body).toBe("Admin deducted 10 points from you. Reason: Misconduct.");
  });

  it("generates the correct dedupeKey", () => {
    const result = buildPointDeductionNotificationData(base);
    expect(result.dedupeKey).toBe("point-deduction-received:org-1:txn-9");
  });
});

describe("buildSeasonStartedNotificationData", () => {
  const base = {
    organizationId: "org-1",
    recipientId: "user-3",
    actorDisplayName: "Owner",
    seasonName: "Spring 2025",
    seasonId: "season-5",
  };

  it("sets the correct notification type and severity", () => {
    const result = buildSeasonStartedNotificationData(base);
    expect(result.type).toBe("SEASON_STARTED");
    expect(result.severity).toBe("INFO");
  });

  it("generates the correct body with season name", () => {
    const result = buildSeasonStartedNotificationData(base);
    expect(result.body).toContain("Spring 2025");
    expect(result.body).toContain("Owner");
  });

  it("generates the correct dedupeKey", () => {
    const result = buildSeasonStartedNotificationData(base);
    expect(result.dedupeKey).toBe("season-started:org-1:season-5");
  });

  it("sets entityType and entityId to the season", () => {
    const result = buildSeasonStartedNotificationData(base);
    expect(result.entityType).toBe("Season");
    expect(result.entityId).toBe("season-5");
  });

  it("sets recipientUserId from recipientId", () => {
    const result = buildSeasonStartedNotificationData(base);
    expect(result.recipientUserId).toBe("user-3");
  });
});

describe("buildRoleChangedNotificationData", () => {
  const base = {
    organizationId: "org-1",
    recipientId: "user-5",
    actorDisplayName: "Owner",
    targetUserDisplayName: "Bob",
    targetUserId: "user-3",
    previousRole: "MEMBER",
    newRole: "ADMIN",
  };

  it("sets the correct notification type and severity", () => {
    const result = buildRoleChangedNotificationData(base);
    expect(result.type).toBe("ROLE_CHANGED");
    expect(result.severity).toBe("INFO");
  });

  it("generates the correct body with role change details", () => {
    const result = buildRoleChangedNotificationData(base);
    expect(result.body).toBe("Owner changed Bob from MEMBER to ADMIN.");
  });

  it("sets entityType and entityId to the target user", () => {
    const result = buildRoleChangedNotificationData(base);
    expect(result.entityType).toBe("User");
    expect(result.entityId).toBe("user-3");
  });

  it("does not include a dedupeKey", () => {
    const result = buildRoleChangedNotificationData(base);
    expect(result.dedupeKey).toBeUndefined();
  });

  it("sets recipientUserId from recipientId (not targetUserId)", () => {
    const result = buildRoleChangedNotificationData(base);
    expect(result.recipientUserId).toBe("user-5");
  });
});

describe("buildMemberNeedsAssignmentNotificationData", () => {
  const base = {
    organizationId: "org-1",
    recipientId: "admin-1",
    joinedUserName: "Charlie",
    organizationName: "Hogwarts",
    joinedUserId: "user-new",
  };

  it("sets the correct notification type and severity", () => {
    const result = buildMemberNeedsAssignmentNotificationData(base);
    expect(result.type).toBe("MEMBER_NEEDS_HOUSE_ASSIGNMENT");
    expect(result.severity).toBe("ACTION_REQUIRED");
  });

  it("generates the correct body with user and org names", () => {
    const result = buildMemberNeedsAssignmentNotificationData(base);
    expect(result.body).toBe("Charlie joined Hogwarts and has not been assigned to a house yet.");
  });

  it("generates the correct dedupeKey scoped to org and user", () => {
    const result = buildMemberNeedsAssignmentNotificationData(base);
    expect(result.dedupeKey).toBe("member-needs-house-assignment:org-1:user-new");
  });

  it("sets entityType and entityId to the joined user", () => {
    const result = buildMemberNeedsAssignmentNotificationData(base);
    expect(result.entityType).toBe("User");
    expect(result.entityId).toBe("user-new");
  });

  it("routes to the team management section", () => {
    const result = buildMemberNeedsAssignmentNotificationData(base);
    expect(result.actionHref).toBe("/?tab=manage&section=team");
  });
});
