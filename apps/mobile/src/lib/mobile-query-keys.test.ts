import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  invalidateMobileQueries,
  mobileMutationInvalidations,
  mobileQueryKeys,
} from "./mobile-query-keys";

describe("mobile query invalidation policy", () => {
  it("maps point changes to every affected organization-scoped surface", () => {
    expect(mobileMutationInvalidations.pointsChanged("alpha")).toEqual([
      mobileQueryKeys.activityRecent("alpha"),
      mobileQueryKeys.dashboardSummary("alpha"),
      mobileQueryKeys.houseLeaderboard("alpha"),
      mobileQueryKeys.adminContext("alpha"),
    ]);
  });

  it("updates both notification list and badge for one organization", () => {
    expect(mobileMutationInvalidations.notificationsChanged("alpha")).toEqual([
      ["notifications", "list", "alpha", "all"],
      ["notifications", "badge", "alpha"],
    ]);
  });

  it("does not invalidate unscoped data when no organization is active", () => {
    expect(mobileMutationInvalidations.memberChanged(null)).toEqual([]);
  });

  it("uses exact keys so another organization's cache is untouched", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(mobileQueryKeys.activityRecent("alpha"), ["alpha"]);
    queryClient.setQueryData(mobileQueryKeys.activityRecent("beta"), ["beta"]);

    await invalidateMobileQueries(
      queryClient,
      mobileMutationInvalidations.reactionChanged("alpha"),
    );

    expect(queryClient.getQueryState(mobileQueryKeys.activityRecent("alpha"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(mobileQueryKeys.activityRecent("beta"))?.isInvalidated).toBe(false);
  });
});
