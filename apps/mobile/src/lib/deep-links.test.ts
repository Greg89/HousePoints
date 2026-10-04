import { describe, expect, it } from "vitest";

import {
  deepLinkFromNotificationData,
  parseHousePointsUrl,
  routeForDeepLink,
} from "./deep-links";

describe("parseHousePointsUrl", () => {
  it.each([
    [
      "housepoints://o/acme/dashboard",
      { kind: "dashboard", organizationSlug: "acme" },
    ],
    [
      "housepoints://o/acme/activity/point-1",
      { kind: "activity", organizationSlug: "acme", pointId: "point-1" },
    ],
    [
      "housepoints://invite/token-1",
      { kind: "invite", token: "token-1" },
    ],
  ])("parses %s", (url, expected) => {
    expect(parseHousePointsUrl(url)).toEqual(expected);
  });

  it.each([
    "https://o/acme/dashboard",
    "housepoints://o/INVALID/dashboard",
    "housepoints://o/acme/activity",
    "housepoints://invite/",
    "housepoints://invite/token/extra",
    "housepoints://o/acme/activity/%E0%A4%A",
  ])("rejects malformed or unsupported URL %s", (url) => {
    expect(parseHousePointsUrl(url)).toBeNull();
  });

  it("maps parsed links to Expo Router paths", () => {
    expect(routeForDeepLink({
      kind: "activity",
      organizationSlug: "acme",
      pointId: "point/1",
    })).toBe("/o/acme/activity/point%2F1");
  });
});

const memberships = [
  { organizationId: "org-1", organizationSlug: "acme" },
  { organizationId: "org-2", organizationSlug: "other" },
];

describe("deepLinkFromNotificationData", () => {
  it("supports explicit legacy invite URLs", () => {
    expect(deepLinkFromNotificationData({ url: "housepoints://invite/token-1" }, []))
      .toEqual({ kind: "invite", token: "token-1" });
  });
  it.each(["POINT_AWARD_RECEIVED", "POINT_DEDUCTION_RECEIVED"])("resolves %s using the server organization ID", type => {
    // Same shape emitted by dispatchPushForNotifications; no slug or URL supplied.
    expect(deepLinkFromNotificationData({ organizationId: "org-2", type, entityId: "point-1", actionHref: "/?tab=activity" }, memberships))
      .toEqual({ kind: "activity", organizationSlug: "other", pointId: "point-1" });
  });
  it("uses the current slug after an organization rename", () => {
    expect(deepLinkFromNotificationData({ organizationId: "org-1", type: "SEASON_STARTED", entityId: "season-1" }, [{ organizationId: "org-1", organizationSlug: "renamed" }]))
      .toEqual({ kind: "dashboard", organizationSlug: "renamed" });
  });
  it("does not interpret a reaction ID as a point ID", () => {
    expect(deepLinkFromNotificationData({ organizationId: "org-1", type: "POINT_REACTION_RECEIVED", entityId: "reaction-1", actionHref: "/?tab=activity" }, memberships))
      .toEqual({ kind: "dashboard", organizationSlug: "acme" });
  });
  it.each([
    { type: "SEASON_STARTED" },
    { organizationId: "revoked", type: "SEASON_STARTED" },
    { organizationId: 123 },
    { organizationId: "org-1", type: "POINT_AWARD_RECEIVED", entityId: "" },
    { organizationId: "org-1", type: "POINT_DEDUCTION_RECEIVED" },
    { organizationId: "org-1", url: "housepoints://o/other/dashboard" },
    { organizationId: "org-1", url: "housepoints://invite/token" },
    { url: "https://untrusted.test/" },
    { url: "housepoints://o/revoked/dashboard" },
  ])("does not guess a destination for %j", data => {
    expect(deepLinkFromNotificationData(data, memberships)).toBeNull();
  });
  it("validates explicit organization URLs against membership", () => {
    expect(deepLinkFromNotificationData({ url: "housepoints://o/acme/dashboard" }, memberships))
      .toEqual({ kind: "dashboard", organizationSlug: "acme" });
    expect(deepLinkFromNotificationData({ organizationId: "org-1", url: "housepoints://o/acme/activity/point-1" }, memberships))
      .toEqual({ kind: "activity", organizationSlug: "acme", pointId: "point-1" });
  });
});
