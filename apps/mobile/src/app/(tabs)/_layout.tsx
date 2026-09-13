import { Redirect, Tabs } from "expo-router";

import { HeaderActions } from "@/components/AlertsHeaderButton";
import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { env } from "@/lib/env";
import { canAccessMobileAdmin } from "@/lib/mobile-admin";
import { mobilePrimaryNavigation } from "@/lib/mobile-navigation";

export default function TabsLayout() {
  const { status } = useAppAuth();
  const { activeOrgSlug, activeMembership, needsPicker } = useActiveOrg();
  const showAdmin = canAccessMobileAdmin(
    env.mobileAdminEnabled,
    activeMembership?.role,
  );
  const primaryDestinations = mobilePrimaryNavigation(showAdmin);

  if (status === "signedOut" || status === "error") {
    return <Redirect href="/login" />;
  }
  if (needsPicker || activeOrgSlug === null || activeMembership === null) {
    return <Redirect href="/pick-org" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#0f172a",
        tabBarInactiveTintColor: "#94a3b8",
        headerRight: () => <HeaderActions />,
      }}
    >
      {primaryDestinations.map((destination) => (
        <Tabs.Screen
          key={destination.route}
          name={destination.route}
          options={{
            title: destination.title,
            href: destination.visible ? undefined : null,
          }}
        />
      ))}
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", href: null }}
      />
    </Tabs>
  );
}
