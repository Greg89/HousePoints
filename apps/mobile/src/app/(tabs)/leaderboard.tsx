import type { DashboardSummary, LeaderboardEntry } from "@housepoints/contracts";
import { useQuery } from "@tanstack/react-query";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { ApiResponseError, callApi } from "@/lib/api-client";
import { useRefreshQueriesOnFocus } from "@/hooks/use-refresh-queries-on-focus";
import { mobileQueryKeys } from "@/lib/mobile-query-keys";
import {
  contributorInitials,
  topContributors,
  type TopContributor,
} from "@/lib/leaderboard";

const FOCUS_QUERY_KEYS = [["dashboard"], ["houses"]] as const;

export default function LeaderboardScreen() {
  const { getAccessToken } = useAppAuth();
  const { activeOrgSlug } = useActiveOrg();
  useRefreshQueriesOnFocus(FOCUS_QUERY_KEYS);

  const summaryQuery = useQuery({
    queryKey: mobileQueryKeys.dashboardSummary(activeOrgSlug),
    enabled: activeOrgSlug !== null,
    queryFn: async ({ signal }) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/dashboard/summary",
        {},
        { accessToken, organizationSlug: activeOrgSlug, signal },
      );
    },
  });

  const housesQuery = useQuery({
    queryKey: mobileQueryKeys.houseLeaderboard(activeOrgSlug),
    enabled: activeOrgSlug !== null,
    queryFn: async ({ signal }) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/houses/leaderboard",
        {},
        { accessToken, organizationSlug: activeOrgSlug, signal },
      );
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([summaryQuery.refetch(), housesQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [summaryQuery, housesQuery]);

  const contributors = useMemo<TopContributor[]>(() => {
    const summary: DashboardSummary | undefined = summaryQuery.data;
    const houses: LeaderboardEntry[] | undefined = housesQuery.data;
    if (!summary || !houses) {
      return [];
    }
    return topContributors(summary.houseMemberRankings, houses);
  }, [housesQuery.data, summaryQuery.data]);

  const initialLoading =
    (summaryQuery.isPending || housesQuery.isPending) &&
    !summaryQuery.data &&
    !housesQuery.data;

  const failed = summaryQuery.error ?? housesQuery.error;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#0f172a"
        />
      }
    >
      <View style={styles.heading}>
        <Text style={styles.title}>Leaderboard</Text>
        {summaryQuery.data ? (
          <Text style={styles.seasonName}>
            {summaryQuery.data.selectedSeason.name}
          </Text>
        ) : null}
      </View>

      {initialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : failed ? (
        <ErrorCard error={failed} onRetry={onRefresh} />
      ) : contributors.length === 0 ? (
        <Text style={styles.empty}>No points awarded yet — be the first!</Text>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="trophy" size={22} color="#f59e0b" />
            <Text style={styles.cardTitle}>Top Contributors</Text>
          </View>
          {contributors.map((contributor, index) => (
            <ContributorRow
              key={contributor.memberId}
              contributor={contributor}
              bordered={index > 0}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function ContributorRow({
  contributor,
  bordered,
}: {
  contributor: TopContributor;
  bordered: boolean;
}) {
  return (
    <View style={[styles.memberRow, bordered && styles.memberRowBorder]}>
      <View style={styles.rank}>
        <Rank rank={contributor.rank} />
      </View>
      <View style={[styles.avatar, { backgroundColor: contributor.houseColor }]}>
        <Text style={styles.avatarText}>
          {contributorInitials(contributor.displayName)}
        </Text>
      </View>
      <View style={styles.memberText}>
        <Text style={styles.memberName}>{contributor.displayName}</Text>
        <Text style={[styles.houseLabel, { color: contributor.houseColor }]}>
          {contributor.houseName}
        </Text>
      </View>
      <View style={[styles.pointsBadge, { backgroundColor: `${contributor.houseColor}20` }]}>
        <Text style={[styles.memberPoints, { color: contributor.houseColor }]}>
          {contributor.points.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

function Rank({ rank }: { rank: number }) {
  if (rank === 1) {
    return <MaterialCommunityIcons name="crown" size={22} color="#eab308" />;
  }
  if (rank === 2) {
    return <MaterialCommunityIcons name="trophy" size={20} color="#94a3b8" />;
  }
  if (rank === 3) {
    return <MaterialCommunityIcons name="medal" size={20} color="#ea580c" />;
  }
  return <Text style={styles.rankText}>{rank}</Text>;
}

function ErrorCard({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const message =
    error instanceof ApiResponseError
      ? error.message
      : "Unable to load the leaderboard. Pull to refresh or tap retry.";
  return (
    <View style={styles.errorCard}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorBody}>{message}</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20, paddingBottom: 40, gap: 20 },
  heading: { paddingTop: 8 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  seasonName: { fontSize: 14, color: "#475569", marginTop: 4 },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: 48,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  memberRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  rank: { width: 26, alignItems: "center", justifyContent: "center" },
  rankText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    fontVariant: ["tabular-nums"],
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  memberText: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: "500", color: "#0f172a" },
  houseLabel: { fontSize: 12, marginTop: 2 },
  pointsBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  memberPoints: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    fontVariant: ["tabular-nums"],
  },
  empty: {
    color: "#64748b",
    fontSize: 14,
    padding: 20,
    textAlign: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  errorCard: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 16,
    gap: 12,
  },
  errorTitle: { fontSize: 15, fontWeight: "700", color: "#991b1b" },
  errorBody: { fontSize: 14, color: "#7f1d1d", lineHeight: 20 },
  retryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#991b1b",
  },
  retryText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
});
