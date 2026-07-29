import type { DashboardSummary, LeaderboardEntry } from "@housepoints/contracts";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";
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

type SeasonStandout = NonNullable<DashboardSummary["seasonStandout"]>;

export default function HomeScreen() {
  const { user, getAccessToken } = useAppAuth();
  const { activeOrgSlug, activeMembership } = useActiveOrg();

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

  const initialLoading =
    (summaryQuery.isPending || housesQuery.isPending) &&
    !summaryQuery.data &&
    !housesQuery.data;

  const failed = summaryQuery.error ?? housesQuery.error;

  // Local annotations force TS to resolve the query response types. Without
  // them TanStack Query's `data` degrades to `any` because `callApi<E>`'s
  // `z.output` return type does not distribute through the generic boundary.
  const summary: DashboardSummary | undefined = summaryQuery.data;
  const houses: LeaderboardEntry[] | undefined = housesQuery.data;

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
        <Text style={styles.greeting}>Hi {user?.displayName ?? "there"}</Text>
        <Text style={styles.org}>
          {activeMembership?.organizationName ?? "-"}
        </Text>
      </View>

      <Pressable
        style={styles.awardButton}
        onPress={() => router.push("/award")}
      >
        <Text style={styles.awardLabel}>+ Award points</Text>
      </Pressable>

      {initialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : failed ? (
        <ErrorCard error={failed} onRetry={onRefresh} />
      ) : (
        <>
          {summary ? (
            <SeasonHeader
              seasonName={summary.selectedSeason.name}
              startsAt={summary.selectedSeason.startsAt}
            />
          ) : null}
          {houses ? <HousesSection houses={houses} /> : null}
          {summary?.seasonStandout ? (
            <StandoutCard standout={summary.seasonStandout} />
          ) : null}
        </>
      )}
    </ScrollView>
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
      : "Unable to load the dashboard. Pull to refresh or tap retry.";
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

function SeasonHeader({
  seasonName,
  startsAt,
}: {
  seasonName: string;
  startsAt: string;
}) {
  const formatted = formatSeasonStart(startsAt);
  return (
    <View style={styles.seasonCard}>
      <Text style={styles.eyebrow}>Current season</Text>
      <Text style={styles.seasonName}>{seasonName}</Text>
      {formatted ? (
        <Text style={styles.seasonMeta}>Started {formatted}</Text>
      ) : null}
    </View>
  );
}

function HousesSection({ houses }: { houses: LeaderboardEntry[] }) {
  const sorted = [...houses].sort((a, b) => b.score - a.score);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Houses</Text>
      {sorted.length === 0 ? (
        <Text style={styles.empty}>
          No houses yet. Ask an admin to set some up.
        </Text>
      ) : (
        <View style={styles.card}>
          {sorted.map((house, index) => (
            <View
              key={house.id}
              style={[styles.houseRow, index > 0 && styles.houseRowBorder]}
            >
              <View style={[styles.dot, { backgroundColor: house.color }]} />
              <View style={styles.houseText}>
                <Text style={styles.houseName}>{house.name}</Text>
                <Text style={styles.houseMeta}>
                  {house.memberCount}{" "}
                  {house.memberCount === 1 ? "member" : "members"}
                  {" \u00b7 "}
                  {house.transactions}{" "}
                  {house.transactions === 1 ? "award" : "awards"}
                </Text>
              </View>
              <Text style={styles.houseScore}>{house.score}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function StandoutCard({ standout }: { standout: SeasonStandout }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Season standout</Text>
      <View style={[styles.card, styles.standoutCard]}>
        <View style={[styles.dot, { backgroundColor: standout.houseColor }]} />
        <View style={styles.standoutText}>
          <Text style={styles.standoutName}>{standout.memberName}</Text>
          <Text style={styles.standoutMeta}>
            {standout.houseName} {"\u00b7"} {standout.points} pts
          </Text>
        </View>
      </View>
    </View>
  );
}

function formatSeasonStart(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20, paddingBottom: 40, gap: 20 },
  heading: { paddingTop: 8 },
  greeting: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  org: { fontSize: 15, color: "#475569", marginTop: 4 },
  awardButton: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  awardLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: 48,
  },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  seasonCard: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
  },
  eyebrow: {
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  seasonName: { fontSize: 22, fontWeight: "700", color: "#f8fafc" },
  seasonMeta: { fontSize: 13, color: "#cbd5e1", marginTop: 6 },
  houseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  houseRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  houseText: { flex: 1 },
  houseName: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  houseMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  houseScore: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    fontVariant: ["tabular-nums"],
  },
  standoutCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  standoutText: { flex: 1 },
  standoutName: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  standoutMeta: { fontSize: 13, color: "#475569", marginTop: 4 },
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
