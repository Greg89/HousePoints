import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const mobileQueryKeys = {
  dashboardSummary: (slug: string | null) => ["dashboard", "summary", slug] as const,
  houseLeaderboard: (slug: string | null) => ["houses", "leaderboard", slug] as const,
  activityRecent: (slug: string | null) => ["activity", "recent", slug] as const,
  members: (slug: string | null) => ["members", slug] as const,
  adminContext: (slug: string | null) => ["admin-context", slug] as const,
  notificationList: (slug: string | null) => ["notifications", "list", slug, "all"] as const,
  notificationBadge: (slug: string | null) => ["notifications", "badge", slug] as const,
};

function forOrg(slug: string | null, keys: QueryKey[]): QueryKey[] {
  return slug ? keys : [];
}

export const mobileMutationInvalidations = {
  pointsChanged: (slug: string | null) => forOrg(slug, [
    mobileQueryKeys.activityRecent(slug),
    mobileQueryKeys.dashboardSummary(slug),
    mobileQueryKeys.houseLeaderboard(slug),
    mobileQueryKeys.adminContext(slug),
  ]),
  memberChanged: (slug: string | null) => forOrg(slug, [
    mobileQueryKeys.members(slug),
    mobileQueryKeys.adminContext(slug),
    mobileQueryKeys.dashboardSummary(slug),
    mobileQueryKeys.houseLeaderboard(slug),
    mobileQueryKeys.activityRecent(slug),
  ]),
  profileChanged: (slug: string | null) => forOrg(slug, [
    mobileQueryKeys.members(slug),
    mobileQueryKeys.adminContext(slug),
    mobileQueryKeys.dashboardSummary(slug),
    mobileQueryKeys.activityRecent(slug),
  ]),
  reactionChanged: (slug: string | null) => forOrg(slug, [
    mobileQueryKeys.activityRecent(slug),
  ]),
  notificationsChanged: (slug: string | null) => forOrg(slug, [
    mobileQueryKeys.notificationList(slug),
    mobileQueryKeys.notificationBadge(slug),
  ]),
};

export async function invalidateMobileQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  queryKeys: readonly QueryKey[],
): Promise<void> {
  await Promise.all(queryKeys.map((queryKey) =>
    queryClient.invalidateQueries({ queryKey, exact: true }),
  ));
}
