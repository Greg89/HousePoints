import type {
  Notification,
  NotificationSeverity,
  PagedNotifications,
} from "@housepoints/contracts";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Stack } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { useToast } from "@/context/toast-provider";
import { ApiResponseError, callApi } from "@/lib/api-client";
import { logger, serializeError } from "@/lib/logger";

const PAGE_LIMIT = 20;

const SEVERITY_ACCENT: Record<NotificationSeverity, string> = {
  INFO: "#3b82f6",
  ACTION_REQUIRED: "#dc2626",
  WARNING: "#f59e0b",
};

export default function NotificationsScreen() {
  const { getAccessToken } = useAppAuth();
  const { activeOrgSlug } = useActiveOrg();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const feedQuery = useInfiniteQuery({
    queryKey: ["notifications", "list", activeOrgSlug, "all"],
    enabled: activeOrgSlug !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/notifications/list",
        { limit: PAGE_LIMIT, cursor: pageParam },
        { accessToken, organizationSlug: activeOrgSlug, signal },
      );
    },
    getNextPageParam: (lastPage: PagedNotifications) =>
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

  const pages: PagedNotifications[] | undefined = feedQuery.data?.pages;
  const items = useMemo<Notification[]>(
    () => pages?.flatMap((page) => page.items) ?? [],
    [pages],
  );
  const unreadCount = pages?.[0]?.unreadCount ?? 0;

  const markReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/notifications/mark-read",
        { notificationIds },
        { accessToken, organizationSlug: activeOrgSlug },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => {
      const message =
        err instanceof ApiResponseError
          ? err.message
          : "Unable to mark as read.";
      showToast({ message, variant: "error" });
      logger.warn(
        "mobile.notifications.mark_read_failed",
        serializeError(err),
      );
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      return callApi(
        "/notifications/mark-all-read",
        {},
        { accessToken, organizationSlug: activeOrgSlug },
      );
    },
    onSuccess: (result) => {
      showToast({
        message:
          result.updatedCount > 0
            ? `Marked ${result.updatedCount} as read`
            : "All caught up",
        variant: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => {
      const message =
        err instanceof ApiResponseError
          ? err.message
          : "Unable to mark all as read.";
      showToast({ message, variant: "error" });
      logger.warn(
        "mobile.notifications.mark_all_failed",
        serializeError(err),
      );
    },
  });

  const onEndReached = useCallback(() => {
    if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
      void feedQuery.fetchNextPage();
    }
  }, [feedQuery]);

  const initialLoading = feedQuery.isPending && items.length === 0;
  const failed = feedQuery.error;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Notifications",
          headerRight: () =>
            unreadCount > 0 ? (
              <Pressable
                style={styles.headerAction}
                onPress={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                hitSlop={8}
              >
                {markAllMutation.isPending ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : (
                  <Text style={styles.headerActionText}>Mark all read</Text>
                )}
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.container}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            onMarkRead={(id) => markReadMutation.mutate([id])}
          />
        )}
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
        ListEmptyComponent={
          initialLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#0f172a" />
            </View>
          ) : failed ? (
            <ErrorCard error={failed} onRetry={onRefresh} />
          ) : (
            <Text style={styles.empty}>
              You&apos;re all caught up. No notifications right now.
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
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function NotificationRow({
  item,
  onMarkRead,
}: {
  item: Notification;
  onMarkRead: (id: string) => void;
}) {
  const isUnread = item.readAt === null;
  const accent = SEVERITY_ACCENT[item.severity];

  return (
    <View style={[styles.row, isUnread && styles.rowUnread]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.rowText}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{item.title}</Text>
          {isUnread ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.body} numberOfLines={4}>
          {item.body}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.timestamp}>
            {formatRelativeTime(item.createdAt)}
          </Text>
          {isUnread ? (
            <Pressable onPress={() => onMarkRead(item.id)} hitSlop={6}>
              <Text style={styles.markReadLink}>Mark read</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
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
      : "Unable to load notifications. Pull to refresh or tap retry.";
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
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  list: { flex: 1, backgroundColor: "#f8fafc" },
  container: { paddingBottom: 40 },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: 48,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#ffffff",
  },
  rowUnread: { backgroundColor: "#f8fbff" },
  accent: { width: 4 },
  rowText: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3b82f6",
  },
  body: { fontSize: 14, color: "#334155", lineHeight: 20 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  timestamp: { fontSize: 12, color: "#64748b" },
  markReadLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  separator: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  headerAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  empty: {
    color: "#64748b",
    fontSize: 14,
    padding: 32,
    textAlign: "center",
  },
  errorCard: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 16,
    gap: 12,
    margin: 20,
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
