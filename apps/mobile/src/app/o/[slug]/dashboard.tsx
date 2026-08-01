import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { DeepLinkAuthGate } from "@/components/DeepLinkAuthGate";
import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";

export default function DashboardDeepLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { status } = useAppAuth();
  const { hydrated, memberships, selectOrg } = useActiveOrg();
  const membership = memberships.find((item) => item.organizationSlug === slug);

  useEffect(() => {
    if (status !== "ready" || !hydrated || !membership) return;
    void selectOrg(membership.organizationSlug).then(() => router.replace("/(tabs)"));
  }, [hydrated, membership, selectOrg, status]);

  return (
    <DeepLinkAuthGate>
      <View style={styles.center}>
        {hydrated && !membership ? (
          <Text style={styles.error}>You do not have access to this organization.</Text>
        ) : <ActivityIndicator size="large" />}
      </View>
    </DeepLinkAuthGate>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#991b1b", textAlign: "center" },
});

