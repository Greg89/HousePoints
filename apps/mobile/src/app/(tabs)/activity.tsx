import {
  POINT_REACTION_LABELS,
  type ActivityItem,
  type PagedActivityFeed,
  type PointReactionDetailsResponse,
  type PointReactionKey,
  type PointReactionResponse,
} from "@housepoints/contracts";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useToast } from "@/context/toast-provider";
import { ApiResponseError, callApi } from "@/lib/api-client";
import {
  nextReactionKey,
  optimisticReactionResponse,
  REACTION_EMOJI,
} from "@/lib/activity-reactions";
import { ReactionPickerModal } from "@/components/ReactionPickerModal";
import { ReactionDetailsModal } from "@/components/ReactionDetailsModal";

const PAGE_LIMIT = 20;

export default function ActivityScreen() {
  const { pointId } = useLocalSearchParams<{ pointId?: string }>();
  const { getAccessToken } = useAppAuth();
  const { activeOrgSlug } = useActiveOrg();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<ActivityItem>>(null);
  const [pickerItem, setPickerItem] = useState<ActivityItem | null>(null);
  const [detailsPointId, setDetailsPointId] = useState<string | null>(null);
  const [optimisticReactions, setOptimisticReactions] = useState<
    Record<string, PointReactionResponse>
  >({});

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
  const displayedItems = useMemo<ActivityItem[]>(
    () => items.map((item) => {
      const optimistic = optimisticReactions[item.id];
      return optimistic
        ? {
            ...item,
            myReactionKey: optimistic.myReactionKey,
            reactions: optimistic.reactions,
          }
        : item;
    }),
    [items, optimisticReactions],
  );

  const reactionMutation = useMutation({
    mutationFn: async (variables: {
      item: ActivityItem;
      nextKey: PointReactionKey | null;
    }) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/transactions/react",
        { transactionId: variables.item.id, reactionKey: variables.nextKey },
        { accessToken, organizationSlug: activeOrgSlug },
      );
    },
    onMutate: ({ item, nextKey }) => {
      setOptimisticReactions((current) => ({
        ...current,
        [item.id]: optimisticReactionResponse(item, nextKey),
      }));
    },
    onSuccess: (response) => {
      setOptimisticReactions((current) => ({
        ...current,
        [response.transactionId]: response,
      }));
    },
    onError: (error, { item }) => {
      setOptimisticReactions((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      showToast({
        message: error instanceof ApiResponseError
          ? error.message
          : "Unable to save your reaction.",
        variant: "error",
      });
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["activity", "recent", activeOrgSlug],
      });
      setOptimisticReactions((current) => {
        const next = { ...current };
        delete next[variables.item.id];
        return next;
      });
    },
  });

  const detailsMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/transactions/reactions",
        { transactionId },
        { accessToken, organizationSlug: activeOrgSlug },
      );
    },
  });
  const reactionDetails: PointReactionDetailsResponse | null =
    detailsMutation.data ?? null;

  const failed = feedQuery.error;
  const initialLoading = feedQuery.isPending && items.length === 0;

  useEffect(() => {
    if (!pointId) return;
    const index = displayedItems.findIndex((item) => item.id === pointId);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.4 });
    }
  }, [displayedItems, pointId]);

  const onEndReached = useCallback(() => {
    if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
      void feedQuery.fetchNextPage();
    }
  }, [feedQuery]);

  return (
    <FlatList
      ref={listRef}
      style={styles.list}
      contentContainerStyle={styles.container}
      data={displayedItems}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ActivityRow
          item={item}
          focused={item.id === pointId}
          reacting={reactionMutation.isPending && reactionMutation.variables?.item.id === item.id}
          onOpenPicker={() => setPickerItem(item)}
          onViewDetails={() => {
            setDetailsPointId(item.id);
            detailsMutation.reset();
            detailsMutation.mutate(item.id);
          }}
        />
      )}
      onScrollToIndexFailed={() => undefined}
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
        <>
          {feedQuery.isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#64748b" />
            </View>
          ) : null}
          <ReactionPickerModal
            visible={pickerItem !== null}
            selected={pickerItem?.myReactionKey ?? null}
            pending={reactionMutation.isPending}
            onClose={() => setPickerItem(null)}
            onSelect={(key) => {
              if (!pickerItem) return;
              const nextKey = nextReactionKey(pickerItem.myReactionKey, key);
              reactionMutation.mutate({ item: pickerItem, nextKey });
              setPickerItem(null);
            }}
          />
          <ReactionDetailsModal
            visible={detailsPointId !== null}
            data={reactionDetails}
            loading={detailsMutation.isPending}
            error={detailsMutation.error
              ? detailsMutation.error instanceof ApiResponseError
                ? detailsMutation.error.message
                : "Unable to load reactions."
              : null}
            onClose={() => setDetailsPointId(null)}
          />
        </>
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function ActivityRow({
  item,
  focused,
  reacting,
  onOpenPicker,
  onViewDetails,
}: {
  item: ActivityItem;
  focused: boolean;
  reacting: boolean;
  onOpenPicker: () => void;
  onViewDetails: () => void;
}) {
  const isDeduction = item.type === "DEDUCTION" || item.delta < 0;
  const displayDelta = Math.abs(item.delta);
  return (
    <Pressable
      style={[styles.row, focused && styles.rowFocused]}
      onLongPress={isDeduction ? undefined : onOpenPicker}
      delayLongPress={350}
    >
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
        {!isDeduction ? (
          <View style={styles.reactionRow}>
            {(item.reactions ?? []).map((reaction) => (
              <Pressable
                key={reaction.reactionKey}
                style={[
                  styles.reactionChip,
                  item.myReactionKey === reaction.reactionKey && styles.reactionChipMine,
                ]}
                onPress={onViewDetails}
                accessibilityLabel={`View ${POINT_REACTION_LABELS[reaction.reactionKey]} reactions`}
              >
                <Text>{REACTION_EMOJI[reaction.reactionKey]} {reaction.count}</Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.reactButton}
              onPress={onOpenPicker}
              disabled={reacting}
              accessibilityLabel="Open reaction picker"
            >
              <Text style={styles.reactButtonText}>
                {reacting ? "Saving…" : item.myReactionKey
                  ? `${REACTION_EMOJI[item.myReactionKey]} Reacted`
                  : "＋ React"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.delta, isDeduction ? styles.deltaNeg : styles.deltaPos]}
      >
        {isDeduction ? "-" : "+"}
        {displayDelta}
      </Text>
    </Pressable>
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
  rowFocused: {
    borderWidth: 2,
    borderColor: "#3b82f6",
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
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  reactionChip: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#ffffff",
  },
  reactionChipMine: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  reactButton: { paddingHorizontal: 8, paddingVertical: 5 },
  reactButtonText: { color: "#2563eb", fontSize: 12, fontWeight: "700" },
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
