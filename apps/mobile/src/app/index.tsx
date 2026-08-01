import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";

/**
 * Entry-point gate. Routes users to the correct top-level surface based on
 * auth + active-org state. All other screens can assume they are only
 * mounted for authenticated users with a resolved org context.
 */
export default function IndexGate() {
  const { status } = useAppAuth();
  const { hydrated, needsPicker, activeOrgSlug, memberships } = useActiveOrg();

  if (status === "initializing" || status === "bootstrapping" || !hydrated) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  if (status === "signedOut" || status === "error") {
    return <Redirect href="/login" />;
  }

  if (needsPicker || (activeOrgSlug === null && memberships.length === 0)) {
    return <Redirect href="/pick-org" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
});
