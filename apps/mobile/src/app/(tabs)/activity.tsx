import {
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
  activityCardPresentation,
} from "@/lib/activity-card";
import {
  nextReactionKey,
  optimisticReactionResponse,
  REACTION_EMOJI,
} from "@/lib/activity-reactions";
import { ReactionPickerModal } from "@/components/ReactionPickerModal";
import { ReactionDetailsModal } from "@/components/ReactionDetailsModal";
import { ReportActivityModal } from "@/components/ReportActivityModal";
import { activityReportPayload, type ReportCategory } from "@/lib/moderation-report";
import { useRefreshQueriesOnFocus } from "@/hooks/use-refresh-queries-on-focus";
import { invalidateMobileQueries, mobileMutationInvalidations, mobileQueryKeys } from "@/lib/mobile-query-keys";

const PAGE_LIMIT = 20;
const FOCUS_QUERY_KEYS = [["activity"]] as const;

export default function ActivityScreen() {
  const { pointId } = useLocalSearchParams<{ pointId?: string }>();
  const { getAccessToken } = useAppAuth();
  const { activeOrgSlug } = useActiveOrg();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  useRefreshQueriesOnFocus(FOCUS_QUERY_KEYS);
  const listRef = useRef<FlatList<ActivityItem>>(null);
  const [pickerItem, setPickerItem] = useState<ActivityItem | null>(null);
  const [detailsPointId, setDetailsPointId] = useState<string | null>(null);
  const [reportItem, setReportItem] = useState<ActivityItem | null>(null);
  const [optimisticReactions, setOptimisticReactions] = useState<
    Record<string, PointReactionResponse>
  >({});

  const feedQuery = useInfiniteQuery({
    queryKey: mobileQueryKeys.activityRecent(activeOrgSlug),
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
      await invalidateMobileQueries(
        queryClient,
        mobileMutationInvalidations.reactionChanged(activeOrgSlug),
      );
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
  const reportMutation = useMutation({
    mutationFn: async (variables: { item: ActivityItem; category: ReportCategory; details: string }) => {
      const accessToken = await getAccessToken();
      return callApi("/moderation/reports/submit", activityReportPayload(variables.item.id, variables.category, variables.details), { accessToken, organizationSlug: activeOrgSlug });
    },
    onSuccess: () => { setReportItem(null); showToast({ message: "Report submitted. Thank you.", variant: "success" }); },
    onError: (error) => showToast({ message: error instanceof ApiResponseError ? error.message : "Unable to submit the report.", variant: "error" }),
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
          onReport={() => setReportItem(item)}
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
          <ReportActivityModal visible={reportItem !== null} pending={reportMutation.isPending} onClose={() => setReportItem(null)} onSubmit={(category, details) => { if (reportItem) reportMutation.mutate({ item: reportItem, category, details }); }} />
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
  onReport,
}: {
  item: ActivityItem;
  focused: boolean;
  reacting: boolean;
  onOpenPicker: () => void;
  onViewDetails: () => void;
  onReport: () => void;
}) {
  const presentation = activityCardPresentation(item);
  return (
    <Pressable
      style={[styles.row, focused && styles.rowFocused]}
      onLongPress={presentation.isDeduction ? undefined : onOpenPicker}
      delayLongPress={350}
    >
      <View style={styles.primaryRow}>
        <View
          style={[styles.avatar, { backgroundColor: item.targetHouseColor }]}
          accessibilityElementsHidden
        >
          <Text style={styles.avatarText}>{presentation.targetInitial}</Text>
        </View>
        <View style={styles.recipientText}>
          <Text style={styles.recipientName}>{item.targetUserName}</Text>
          <Text style={[styles.houseName, { color: item.targetHouseColor }]}>
            {item.targetHouseName}
          </Text>
          <Text
            testID={`mobile.activity.attribution.${item.id}`}
            style={styles.attribution}
          >
            {presentation.attributionLabel}{" "}
            <Text style={styles.actorName}>{item.actorName}</Text>
          </Text>
        </View>
        <View
          style={[
            styles.pointsBadge,
            presentation.isDeduction
              ? styles.pointsBadgeDeduction
              : styles.pointsBadgeAward,
          ]}
        >
          <Text
            style={[
              styles.delta,
              presentation.isDeduction ? styles.deltaNeg : styles.deltaPos,
            ]}
          >
            {presentation.deltaLabel}
          </Text>
          <Text
            style={[
              styles.pointsLabel,
              presentation.isDeduction ? styles.deltaNeg : styles.deltaPos,
            ]}
          >
            points
          </Text>
        </View>
      </View>

      <View style={styles.contentSection}>
        <Text style={styles.reason}>{item.reason}</Text>
        <View style={styles.metaRow}>
          {presentation.traitLabel ? (
            <View style={styles.traitChip}>
              <Text style={styles.traitLabel}>{presentation.traitLabel}</Text>
            </View>
          ) : null}
          {item.season ? (
            <View
              style={[
                styles.seasonChip,
                item.season.isActive
                  ? styles.activeSeasonChip
                  : styles.historicalSeasonChip,
              ]}
            >
              <Text
                style={
                  item.season.isActive
                    ? styles.activeSeasonLabel
                    : styles.historicalSeasonLabel
                }
                numberOfLines={1}
              >
                {item.season.name}
              </Text>
            </View>
          ) : null}
          {presentation.isDeduction ? (
            <View style={styles.deductionChip}>
              <Text style={styles.deductionLabel}>Deducted</Text>
            </View>
          ) : null}
          <Text style={styles.timestamp}>
            {presentation.relativeTime}
          </Text>
        </View>
        {!presentation.isDeduction ? (
          <View style={styles.reactionRow}>
            {presentation.topReactions.map((reaction) => (
              <Pressable
                key={reaction.reactionKey}
                style={[
                  styles.reactionChip,
                  reaction.mine && styles.reactionChipMine,
                ]}
                onPress={onViewDetails}
                accessibilityLabel={`View ${reaction.label} reactions`}
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
        <Pressable style={styles.reportButton} onPress={onReport} accessibilityLabel="Report activity"><Text style={styles.reportButtonText}>⚑ Report</Text></Pressable>
      </View>
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
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  rowFocused: {
    borderWidth: 2,
    borderColor: "#3b82f6",
  },
  separator: {
    height: 12,
  },
  primaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  recipientText: { flex: 1 },
  recipientName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  houseName: { fontSize: 12, marginTop: 2, fontWeight: "500" },
  attribution: { fontSize: 12, color: "#64748b", marginTop: 8 },
  actorName: { color: "#0f172a", fontWeight: "600" },
  pointsBadge: {
    minWidth: 68,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  pointsBadgeAward: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  pointsBadgeDeduction: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  contentSection: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    padding: 14,
  },
  reason: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  traitChip: {
    backgroundColor: "#e0e7ff",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  traitLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3730a3",
  },
  seasonChip: { maxWidth: 128, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  activeSeasonChip: { backgroundColor: "#ecfdf5" },
  historicalSeasonChip: { backgroundColor: "#fffbeb" },
  activeSeasonLabel: { fontSize: 11, fontWeight: "600", color: "#047857" },
  historicalSeasonLabel: { fontSize: 11, fontWeight: "600", color: "#b45309" },
  deductionChip: { backgroundColor: "#fee2e2", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  deductionLabel: { fontSize: 11, fontWeight: "700", color: "#b91c1c" },
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
  reportButton: { alignSelf: "flex-end", marginTop: 10, paddingHorizontal: 8, paddingVertical: 5 },
  reportButtonText: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  delta: {
    fontSize: 21,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  pointsLabel: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
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
