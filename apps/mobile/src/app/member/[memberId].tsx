import type { MemberPerformance } from "@housepoints/contracts";
import { useQuery } from "@tanstack/react-query";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MemberPerformanceReport } from "@/components/MemberPerformanceReport";
import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { useHouseOverview } from "@/hooks/use-house-overview";
import { useRefreshQueriesOnFocus } from "@/hooks/use-refresh-queries-on-focus";
import { ApiResponseError, callApi } from "@/lib/api-client";
import { mobileQueryKeys } from "@/lib/mobile-query-keys";

const FOCUS_KEYS = [["member-performance"]] as const;

export default function MemberDetailsScreen() {
  const params = useLocalSearchParams<{ memberId?: string | string[] }>();
  const memberId = typeof params.memberId === "string" ? params.memberId : "";
  const { status, getAccessToken } = useAppAuth();
  const { activeOrgSlug, activeMembership, hydrated, needsPicker } = useActiveOrg();
  const { summaryQuery, housesQuery, summary, houses } = useHouseOverview();
  const [refreshing, setRefreshing] = useState(false);
  useRefreshQueriesOnFocus(FOCUS_KEYS);
  const seasonId = summary?.selectedSeason.id ?? null;
  const enabled = status === "ready" && hydrated && !!activeOrgSlug && !!activeMembership && !!memberId && !!seasonId;
  const performanceQuery = useQuery({
    queryKey: mobileQueryKeys.memberPerformance(activeOrgSlug, memberId, seasonId),
    enabled,
    queryFn: async ({ signal }) => callApi("/members/performance", { memberId, seasonId: seasonId! }, {
      accessToken: await getAccessToken(), organizationSlug: activeOrgSlug, signal,
    }),
  });
  const performance: MemberPerformance | undefined = performanceQuery.data;
  const error = summaryQuery.error ?? housesQuery.error ?? performanceQuery.error;
  const accessDenied = error instanceof ApiResponseError && [401, 403, 404].includes(error.statusCode);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([summaryQuery.refetch(), housesQuery.refetch(), ...(enabled ? [performanceQuery.refetch()] : [])]);
    } finally { setRefreshing(false); }
  };
  if (status === "signedOut" || status === "error") return <Redirect href="/login" />;
  if (status !== "ready" || !hydrated) return <ActivityIndicator accessibilityLabel="Loading member performance" />;
  if (needsPicker || !activeOrgSlug || !activeMembership) return <Redirect href="/pick-org" />;

  return (
    <SafeAreaView style={styles.screen} edges={["bottom", "left", "right"]}>
      <Stack.Screen options={{ headerShown: true, title: performance?.member.displayName ?? "Member performance" }} />
      <ScrollView testID="mobile.member.details" contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {!memberId ? <Text>This member is not available.</Text> : <>
          {error ? <View style={styles.message}>
            <Text style={styles.error}>{error instanceof ApiResponseError ? error.message : "Unable to load member performance."}</Text>
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.retry}><Text>Retry</Text></Pressable>
          </View> : null}
          {summaryQuery.isPending || housesQuery.isPending || (enabled && performanceQuery.isPending)
            ? <ActivityIndicator accessibilityLabel="Loading member performance" />
            : !accessDenied && performance && summary && houses
              ? <MemberPerformanceReport performance={performance} summary={summary} houses={houses} />
              : null}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" }, content: { padding: 20, paddingBottom: 32 },
  message: { paddingBottom: 16 }, error: { color: "#991b1b" },
  retry: { alignSelf: "flex-start", marginTop: 12, padding: 14, borderRadius: 8, backgroundColor: "#e2e8f0" },
});
