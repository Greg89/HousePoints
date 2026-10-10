import type { DashboardSummary, LeaderboardEntry } from "@housepoints/contracts";
import { useQuery } from "@tanstack/react-query";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { callApi } from "@/lib/api-client";
import { mobileQueryKeys } from "@/lib/mobile-query-keys";
import { CATEGORY_READ_CAPABILITY } from "@/lib/recognition-categories";
import { useRefreshQueriesOnFocus } from "./use-refresh-queries-on-focus";

const FOCUS_QUERY_KEYS = [["dashboard"], ["houses"]] as const;

/** Home and house details share org-scoped caches and mutation invalidation. */
export function useHouseOverview() {
  const { status, getAccessToken } = useAppAuth();
  const { activeOrgSlug, activeMembership, hydrated } = useActiveOrg();
  useRefreshQueriesOnFocus(FOCUS_QUERY_KEYS);
  const enabled = status === "ready" && hydrated && activeOrgSlug !== null && activeMembership !== null;
  const summaryQuery = useQuery({
    queryKey: mobileQueryKeys.dashboardSummary(activeOrgSlug),
    enabled,
    queryFn: async ({ signal }) => callApi("/dashboard/summary", CATEGORY_READ_CAPABILITY, {
      accessToken: await getAccessToken(), organizationSlug: activeOrgSlug, signal,
    }),
  });
  const housesQuery = useQuery({
    queryKey: mobileQueryKeys.houseLeaderboard(activeOrgSlug),
    enabled,
    queryFn: async ({ signal }) => callApi("/houses/leaderboard", {}, {
      accessToken: await getAccessToken(), organizationSlug: activeOrgSlug, signal,
    }),
  });
  // Explicit annotations preserve contract types through the generic API client.
  const summary: DashboardSummary | undefined = summaryQuery.data;
  const houses: LeaderboardEntry[] | undefined = housesQuery.data;
  return { summaryQuery, housesQuery, summary, houses };
}
