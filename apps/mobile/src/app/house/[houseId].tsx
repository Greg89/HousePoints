import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HouseOverviewReport } from "@/components/HouseOverviewReport";
import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { useHouseOverview } from "@/hooks/use-house-overview";
import { ApiResponseError } from "@/lib/api-client";
import { env } from "@/lib/env";

export default function HouseDetailsScreen() {
  const { houseId } = useLocalSearchParams<{ houseId?: string | string[] }>();
  const { status } = useAppAuth();
  const { activeOrgSlug, activeMembership, hydrated, needsPicker } = useActiveOrg();
  const { summaryQuery, housesQuery, summary, houses } = useHouseOverview();
  const [refreshing, setRefreshing] = useState(false);
  const house = typeof houseId === "string" ? houses?.find((entry) => entry.id === houseId) : undefined;
  const error = summaryQuery.error ?? housesQuery.error;
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([summaryQuery.refetch(), housesQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (status === "signedOut" || status === "error") return <Redirect href="/login" />;
  if (status !== "ready" || !hydrated) return <ActivityIndicator accessibilityLabel="Loading house details" />;
  if (needsPicker || !activeOrgSlug || !activeMembership) return <Redirect href="/pick-org" />;

  return (
    <SafeAreaView style={styles.screen} edges={["bottom", "left", "right"]}>
      <Stack.Screen options={{ headerShown: true, title: house?.name ?? "House details", headerBackTitle: "Home" }} />
      <ScrollView
        testID="mobile.house.details"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {error ? (
          <View style={styles.message}>
            <Text style={styles.error}>{error instanceof ApiResponseError ? error.message : "Unable to load house details."}</Text>
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.retry}><Text>Retry</Text></Pressable>
          </View>
        ) : null}
        {summaryQuery.isPending || housesQuery.isPending ? (
          <ActivityIndicator accessibilityLabel="Loading house details" />
        ) : !house && !error ? (
          <Text style={styles.message}>This house is not available in your current organization.</Text>
        ) : house && summary ? (
          <HouseOverviewReport house={house} summary={summary} categoryMode={env.recognitionCategoriesEnabled} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, paddingBottom: 32 },
  message: { padding: 20, color: "#475569" },
  error: { color: "#991b1b", fontSize: 14 },
  retry: { alignSelf: "flex-start", marginTop: 12, padding: 14, borderRadius: 8, backgroundColor: "#e2e8f0" },
});
