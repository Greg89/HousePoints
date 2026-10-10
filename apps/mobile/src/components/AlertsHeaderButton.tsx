import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { PagedNotifications } from "@housepoints/contracts";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { callApi } from "@/lib/api-client";
import { mobileQueryKeys } from "@/lib/mobile-query-keys";

/**
 * Notification bell shared across mobile tab headers. Fetches the notification
 * unread count with a minimal payload (`limit: 1`) and renders a badge when
 * there are unread items. Shares the `["notifications"]` cache root with the
 * full Notifications screen so mark-read mutations invalidate both.
 */
export function AlertsHeaderButton() {
  const { getAccessToken } = useAppAuth();
  const { activeOrgSlug } = useActiveOrg();

  const query = useQuery({
    queryKey: mobileQueryKeys.notificationBadge(activeOrgSlug),
    enabled: activeOrgSlug !== null,
    queryFn: async ({ signal }) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/notifications/list",
        { limit: 1 },
        { accessToken, organizationSlug: activeOrgSlug, signal },
      );
    },
  });

  const data: PagedNotifications | undefined = query.data;
  const unread = data?.unreadCount ?? 0;

  return (
    <Pressable
      testID="mobile.header.notifications"
      style={styles.button}
      onPress={() => router.push("/notifications")}
      hitSlop={5}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
      }
    >
      <MaterialCommunityIcons name={unread > 0 ? "bell" : "bell-outline"} size={21} color="#0f172a" accessible={false} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function AccountHeaderButton() {
  const { user } = useAppAuth();
  const initial = user?.displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <Pressable
      testID="mobile.header.account"
      style={styles.avatarButton}
      onPress={() => router.push("/(tabs)/profile")}
      hitSlop={5}
      accessibilityRole="button"
      accessibilityLabel="Account and profile"
      accessibilityHint="Opens your profile and organization settings"
    >
      <Text style={styles.avatarLabel}>{initial}</Text>
    </Pressable>
  );
}

export function HeaderActions() {
  return (
    <View style={styles.actions}>
      <AlertsHeaderButton />
      <AccountHeaderButton />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    gap: 12,
  },
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  avatarLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
