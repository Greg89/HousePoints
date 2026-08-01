import type { DashboardSummary, LeaderboardEntry } from "@housepoints/contracts";
import { useQuery } from "@tanstack/react-query";
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

type HouseRanking = DashboardSummary["houseMemberRankings"][number];
type Member = HouseRanking["members"][number];

type HouseSection = {
  house: LeaderboardEntry;
  members: Member[];
};

export default function LeaderboardScreen() {
  const { getAccessToken } = useAppAuth();
  const { activeOrgSlug } = useActiveOrg();

  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary", activeOrgSlug],
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
    queryKey: ["houses", "leaderboard", activeOrgSlug],
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

  const sections = useMemo<HouseSection[]>(() => {
    const summary: DashboardSummary | undefined = summaryQuery.data;
    const houses: LeaderboardEntry[] | undefined = housesQuery.data;
    if (!summary || !houses) {
      return [];
    }
    const rankingsByHouseId = new Map<string, Member[]>(
      summary.houseMemberRankings.map((entry) => [entry.houseId, entry.members]),
    );
    return [...houses]
      .sort((a, b) => b.score - a.score)
      .map((house) => ({
        house,
        members: [...(rankingsByHouseId.get(house.id) ?? [])].sort(
          (a, b) => b.points - a.points,
        ),
      }));
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
      ) : sections.length === 0 ? (
        <Text style={styles.empty}>
          No houses yet. Ask an admin to set some up.
        </Text>
      ) : (
        sections.map((section) => (
          <HouseSectionView key={section.house.id} section={section} />
        ))
      )}
    </ScrollView>
  );
}

function HouseSectionView({ section }: { section: HouseSection }) {
  const { house, members } = section;
  return (
    <View style={styles.section}>
      <View style={styles.houseHeader}>
        <View style={[styles.dot, { backgroundColor: house.color }]} />
        <Text style={styles.houseName}>{house.name}</Text>
        <Text style={styles.houseScore}>{house.score}</Text>
      </View>
      {members.length === 0 ? (
        <Text style={styles.emptyInline}>No members yet.</Text>
      ) : (
        <View style={styles.card}>
          {members.map((member, index) => (
            <View
              key={member.memberId}
              style={[styles.memberRow, index > 0 && styles.memberRowBorder]}
            >
              <Text style={styles.rank}>{index + 1}</Text>
              <View style={styles.memberText}>
                <Text style={styles.memberName}>{member.displayName}</Text>
                {member.role !== "MEMBER" ? (
                  <Text style={styles.memberRole}>
                    {roleLabel(member.role)}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.memberPoints}>{member.points}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
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

function roleLabel(role: Member["role"]): string {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "ADMIN":
      return "Admin";
    default:
      return "Member";
  }
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
  section: { gap: 10 },
  houseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  houseName: { flex: 1, fontSize: 16, fontWeight: "700", color: "#0f172a" },
  houseScore: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    fontVariant: ["tabular-nums"],
  },
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
  rank: {
    width: 26,
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    fontVariant: ["tabular-nums"],
  },
  memberText: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: "500", color: "#0f172a" },
  memberRole: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
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
  emptyInline: {
    color: "#64748b",
    fontSize: 13,
    fontStyle: "italic",
    paddingHorizontal: 4,
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
