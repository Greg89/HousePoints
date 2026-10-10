import { MemberDetailsLink } from "@/components/MemberDetailsLink";
import { HousesSection } from "@/components/HousesSection";
import { useHouseOverview } from "@/hooks/use-house-overview";
import type { DashboardSummary } from "@housepoints/contracts";
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
import { ApiResponseError } from "@/lib/api-client";

type SeasonStandout = NonNullable<DashboardSummary["seasonStandout"]>;

export default function HomeScreen() {
  const { user } = useAppAuth();
  const { activeMembership } = useActiveOrg();
  const { summaryQuery, housesQuery, summary, houses } = useHouseOverview();

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

  return (
    <ScrollView
      testID="mobile.home.dashboard"
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

      {(initialLoading || failed || !summary) ? <AwardPointsButton /> : null}

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
              isActive={summary.selectedSeason.isActive}
              plannedEndsAt={summary.selectedSeason.plannedEndsAt ?? null}
              timezone={summary.selectedSeason.timezone ?? null}
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
  isActive,
  plannedEndsAt,
  timezone,
}: {
  seasonName: string;
  startsAt: string;
  isActive: boolean;
  plannedEndsAt: string | null;
  timezone: string | null;
}) {
  const formatted = formatSeasonStart(startsAt);
  const plannedEnd = plannedEndsAt
    ? formatPlannedSeasonEnd(plannedEndsAt, timezone)
    : null;
  const plannedEndPassed = plannedEndsAt
    ? new Date(plannedEndsAt).getTime() < Date.now()
    : false;
  return (
    <View style={styles.seasonCard}>
      <Text style={styles.eyebrow}>Current season</Text>
      <Text style={styles.seasonName}>{seasonName}</Text>
      {formatted ? (
        <Text style={styles.seasonMeta}>Started {formatted}</Text>
      ) : null}
      {isActive && plannedEnd ? (
        <Text style={[styles.seasonMeta, plannedEndPassed && styles.seasonWarning]}>
          {plannedEndPassed
            ? `Past planned end (${plannedEnd}); awaiting next kickoff. Awards continue.`
            : `Planned end: ${plannedEnd}. Awards continue until kickoff.`}
        </Text>
      ) : null}
      <AwardPointsButton />
    </View>
  );
}

function AwardPointsButton() {
  return (
    <Pressable
      testID="mobile.home.award-points"
      accessibilityLabel="Award points"
      accessibilityRole="button"
      style={({ pressed }) => [styles.awardButton, pressed && styles.awardPressed]}
      onPress={() => router.push("/award")}
    >
      <Text style={styles.awardLabel}>+ Award points</Text>
    </Pressable>
  );
}

function StandoutCard({ standout }: { standout: SeasonStandout }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Season standout</Text>
      <Text style={styles.standoutMeta}>Long press to view performance.</Text>
      <MemberDetailsLink memberId={standout.memberId} name={standout.memberName} style={[styles.card, styles.standoutCard]}>
        <View style={[styles.dot, { backgroundColor: standout.houseColor }]} />
        <View style={styles.standoutText}>
          <Text style={styles.standoutName}>{standout.memberName}</Text>
          <Text style={styles.standoutMeta}>
            {standout.houseName} {"\u00b7"} {standout.points} pts
          </Text>
        </View>
      </MemberDetailsLink>
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

function formatPlannedSeasonEnd(iso: string, timezone: string | null): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone ?? undefined,
    timeZoneName: timezone ? "short" : undefined,
  }).format(date);
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20, paddingBottom: 40, gap: 20 },
  heading: { paddingTop: 8 },
  greeting: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  org: { fontSize: 15, color: "#475569", marginTop: 4 },
  awardButton: {
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    borderRadius: 12,
    marginTop: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  awardPressed: { backgroundColor: "#e0e7ff" },
  awardLabel: {
    color: "#3730a3",
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
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
  },
  eyebrow: {
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  seasonName: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  seasonMeta: { fontSize: 13, color: "#64748b", lineHeight: 19, marginTop: 6 },
  seasonWarning: { color: "#92400e" },
  dot: { width: 12, height: 12, borderRadius: 6 },
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
