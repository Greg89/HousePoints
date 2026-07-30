import { Redirect, Tabs } from "expo-router";

import { AlertsHeaderButton } from "@/components/AlertsHeaderButton";
import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { env } from "@/lib/env";
import { canAccessMobileAdmin } from "@/lib/mobile-admin";

export default function TabsLayout() {
  const { status } = useAppAuth();
  const { activeOrgSlug, activeMembership, needsPicker } = useActiveOrg();
  const showAdmin = canAccessMobileAdmin(
    env.mobileAdminEnabled,
    activeMembership?.role,
  );

  if (status === "signedOut" || status === "error") {
    return <Redirect href="/login" />;
  }
  if (needsPicker || activeOrgSlug === null) {
    return <Redirect href="/pick-org" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#0f172a",
        tabBarInactiveTintColor: "#94a3b8",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerRight: () => <AlertsHeaderButton />,
        }}
      />
      <Tabs.Screen name="leaderboard" options={{ title: "Leaderboard" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity" }} />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          href: showAdmin ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
