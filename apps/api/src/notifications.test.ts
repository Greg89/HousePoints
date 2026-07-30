import type { FastifyBaseLogger } from "fastify";
import { describe, it, expect, vi } from "vitest";
import {
  buildPointAwardNotificationData,
  buildPointDeductionNotificationData,
  buildPointReactionNotificationData,
  buildSeasonStartedNotificationData,
  buildRoleChangedNotificationData,
  buildMemberNeedsAssignmentNotificationData,
  buildReleaseAnnouncementNotificationData,
  dispatchPushForNotifications,
} from "./notifications.js";

describe("dispatchPushForNotifications", () => {
  it("looks up active org-scoped devices and dispatches mapped messages", async () => {
    const row = buildPointAwardNotificationData({
      organizationId: "org-1",
      recipientUserId: "user-2",
      actorDisplayName: "Alice",
      delta: 5,
      trait: "LEADERSHIP",
      transactionId: "txn-1",
    });
    const client = {
      deviceRegistration: {
        findMany: vi.fn().mockResolvedValue([{
          organizationId: "org-1",
          userId: "user-2",
          pushToken: "ExponentPushToken[test]",
        }]),
      },
    };
    const dispatcher = {
      send: vi.fn().mockResolvedValue({ acceptedCount: 1 }),
    };
    const logger = { info: vi.fn(), error: vi.fn() } as unknown as FastifyBaseLogger;

    await dispatchPushForNotifications({ rows: [row], client, dispatcher, logger });

    expect(dispatcher.send).toHaveBeenCalledWith([expect.objectContaining({
      to: "ExponentPushToken[test]",
      title: "Points awarded",
      data: expect.objectContaining({
        organizationId: "org-1",
        type: "POINT_AWARD_RECEIVED",
      }),
    })]);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "notifications.push_dispatched", deviceCount: 1 }),
      "notifications.push_dispatched",
    );
  });

  it("logs provider failures without rejecting the notification operation", async () => {
    const row = buildPointAwardNotificationData({
      organizationId: "org-1",
      recipientUserId: "user-2",
      actorDisplayName: "Alice",
      delta: 5,
      trait: "LEADERSHIP",
      transactionId: "txn-1",
    });
    const client = {
      deviceRegistration: {
        findMany: vi.fn().mockResolvedValue([{
          organizationId: "org-1",
          userId: "user-2",
          pushToken: "ExponentPushToken[test]",
        }]),
      },
    };
    const dispatcher = { send: vi.fn().mockRejectedValue(new Error("offline")) };
    const logger = { info: vi.fn(), error: vi.fn() } as unknown as FastifyBaseLogger;

    await expect(dispatchPushForNotifications({ rows: [row], client, dispatcher, logger }))
      .resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "notifications.push_failed" }),
      "notifications.push_failed",
    );
  });
});

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

describe("buildPointReactionNotificationData", () => {
  const base = {
    organizationId: "org-1",
    recipientUserId: "user-2",
    actorUserId: "user-3",
    actorDisplayName: "Casey",
    reactionKey: "clap" as const,
    transactionId: "txn-1",
    reactionId: "reaction-1",
  };

  it("sets the correct notification type and severity", () => {
    const result = buildPointReactionNotificationData(base);
    expect(result.type).toBe("POINT_REACTION_RECEIVED");
    expect(result.severity).toBe("INFO");
  });

  it("generates user-facing copy from the reaction label", () => {
    const result = buildPointReactionNotificationData(base);
    expect(result.title).toBe("Someone reacted to your recognition");
    expect(result.body).toBe("Casey reacted with Applause.");
  });

  it("dedupes by org, transaction, and reacting actor", () => {
    const result = buildPointReactionNotificationData(base);
    expect(result.dedupeKey).toBe("point-reaction-received:org-1:txn-1:user-3");
  });

  it("sets entityType and entityId to the reaction", () => {
    const result = buildPointReactionNotificationData(base);
    expect(result.entityType).toBe("PointReaction");
    expect(result.entityId).toBe("reaction-1");
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

describe("buildReleaseAnnouncementNotificationData", () => {
  const base = {
    organizationId: "org-1",
    recipientId: "user-1",
    releaseId: "release-1",
    version: "v1.2.3",
    title: "Multi-org beta",
    summary: "Multi-organization support is now available in beta.",
    releaseNotesUrl: "https://example.com/releases/v1.2.3.html",
  };

  it("sets the correct notification type and severity", () => {
    const result = buildReleaseAnnouncementNotificationData(base);
    expect(result.type).toBe("RELEASE_ANNOUNCEMENT");
    expect(result.severity).toBe("INFO");
  });

  it("generates user-facing copy from the release metadata", () => {
    const result = buildReleaseAnnouncementNotificationData(base);
    expect(result.title).toBe("What's new: Multi-org beta");
    expect(result.body).toBe("Multi-organization support is now available in beta.");
  });

  it("generates a dedupe key scoped by release version and organization", () => {
    const result = buildReleaseAnnouncementNotificationData(base);
    expect(result.dedupeKey).toBe("release-announcement:v1.2.3:org-1");
  });

  it("sets entityType and entityId to the release", () => {
    const result = buildReleaseAnnouncementNotificationData(base);
    expect(result.entityType).toBe("ReleaseAnnouncement");
    expect(result.entityId).toBe("release-1");
  });

  it("links to the release notes", () => {
    const result = buildReleaseAnnouncementNotificationData(base);
    expect(result.actionLabel).toBe("View release notes");
    expect(result.actionHref).toBe("https://example.com/releases/v1.2.3.html");
  });
});
