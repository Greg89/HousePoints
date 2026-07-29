import type { ActivityItem, PagedActivityFeed } from "@housepoints/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { ApiResponseError, callApi } from "@/lib/api-client";

const PAGE_LIMIT = 20;

export default function ActivityScreen() {
  const { getAccessToken } = useAppAuth();
  const { activeOrgSlug } = useActiveOrg();

  const feedQuery = useInfiniteQuery({
    queryKey: ["activity", "recent", activeOrgSlug],
    enabled: activeOrgSlug !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/transactions/recent",
        { cursor: pageParam, limit: PAGE_LIMIT },
        { accessToken, organizationSlug: activeOrgSlug, signal },
      );
    },
    getNextPageParam: (lastPage: PagedActivityFeed) =>
      lastPage.nextCursor ?? undefined,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await feedQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [feedQuery]);

  // Local annotation forces the paged response type to resolve; see the mobile
  // notes: callApi's `z.output<generic>` degrades through TanStack Query.
  const pages: PagedActivityFeed[] | undefined = feedQuery.data?.pages;
  const items = useMemo<ActivityItem[]>(
    () => pages?.flatMap((page) => page.items) ?? [],
    [pages],
  );

  const failed = feedQuery.error;
  const initialLoading = feedQuery.isPending && items.length === 0;

  const onEndReached = useCallback(() => {
    if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
      void feedQuery.fetchNextPage();
    }
  }, [feedQuery]);

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ActivityRow item={item} />}
      ItemSeparatorComponent={Separator}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#0f172a"
        />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={styles.heading}>
          <Text style={styles.title}>Activity</Text>
          <Text style={styles.subtitle}>
            Most recent points across your organization
          </Text>
        </View>
      }
      ListEmptyComponent={
        initialLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0f172a" />
          </View>
        ) : failed ? (
          <ErrorCard error={failed} onRetry={onRefresh} />
        ) : (
          <Text style={styles.empty}>
            No activity yet. Award some points to get started.
          </Text>
        )
      }
      ListFooterComponent={
        feedQuery.isFetchingNextPage ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color="#64748b" />
          </View>
        ) : null
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const isDeduction = item.type === "DEDUCTION" || item.delta < 0;
  const displayDelta = Math.abs(item.delta);
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: item.targetHouseColor }]} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>
          <Text style={styles.name}>{item.actorName}</Text>
          <Text>{isDeduction ? " deducted from " : " awarded "}</Text>
          <Text style={styles.name}>{item.targetUserName}</Text>
        </Text>
        {item.reason ? (
          <Text style={styles.reason} numberOfLines={3}>
            {item.reason}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {item.trait ? (
            <View style={styles.traitChip}>
              <Text style={styles.traitLabel}>{formatTrait(item.trait)}</Text>
            </View>
          ) : null}
          <Text style={styles.timestamp}>
            {formatRelativeTime(item.createdAt)}
          </Text>
        </View>
      </View>
      <Text
        style={[styles.delta, isDeduction ? styles.deltaNeg : styles.deltaPos]}
      >
        {isDeduction ? "-" : "+"}
        {displayDelta}
      </Text>
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
      : "Unable to load activity. Pull to refresh or tap retry.";
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

function formatTrait(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "";
  }
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20, paddingBottom: 40 },
  heading: { paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 4 },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: 48,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: "#ffffff",
  },
  separator: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 0,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, color: "#0f172a", lineHeight: 20 },
  name: { fontWeight: "600" },
  reason: {
    fontSize: 13,
    color: "#475569",
    marginTop: 4,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  traitChip: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  traitLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  timestamp: { fontSize: 12, color: "#64748b" },
  delta: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    minWidth: 44,
    textAlign: "right",
  },
  deltaPos: { color: "#15803d" },
  deltaNeg: { color: "#b91c1c" },
  empty: {
    color: "#64748b",
    fontSize: 14,
    padding: 24,
    textAlign: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 12,
  },
  errorCard: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 16,
    gap: 12,
    marginTop: 12,
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
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
