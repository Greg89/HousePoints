import { Redirect, Tabs } from "expo-router";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";

export default function TabsLayout() {
  const { status } = useAppAuth();
  const { activeOrgSlug, needsPicker } = useActiveOrg();

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
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="leaderboard" options={{ title: "Leaderboard" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
