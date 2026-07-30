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

describe("deepLinkFromNotificationData", () => {
  it("prefers a canonical URL supplied by the notification", () => {
    expect(deepLinkFromNotificationData({
      url: "housepoints://invite/token-1",
    }, "acme")).toEqual({ kind: "invite", token: "token-1" });
  });

  it("routes point notifications to activity in the registered organization", () => {
    expect(deepLinkFromNotificationData({
      type: "POINT_AWARD_RECEIVED",
      entityId: "point-1",
    }, "acme")).toEqual({
      kind: "activity",
      organizationSlug: "acme",
      pointId: "point-1",
    });
  });

  it("routes other notifications to the organization dashboard", () => {
    expect(deepLinkFromNotificationData({
      type: "SEASON_STARTED",
      entityId: "season-1",
    }, "acme")).toEqual({ kind: "dashboard", organizationSlug: "acme" });
  });

  it("waits for active organization hydration when no URL is supplied", () => {
    expect(deepLinkFromNotificationData({ type: "SEASON_STARTED" }, null)).toBeNull();
  });
});
